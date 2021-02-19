const PORT_NUMBER = 8080;

var connectionArray = [];
var nextID = Date.now();

const express = require('express');
const WebSocketServer = require('ws').Server;

var app = express();
var router = express.Router();

app.use("/", router);
app.use(express.static("views"));
app.use(express.static("public"));

function log(text) {
    var time = new Date();
    console.log("[" + time.toLocaleTimeString() + "] " + text);
}

log("HTTP server configured");

var httpServer = app.listen(PORT_NUMBER, function() {
    log("Static web server now listening");
});

function insertUser(newConnect) {
    var idx = connectionArray.findIndex((element) => {
        return element.name === newConnect.name});

    while (idx !== -1) {
        connectionArray.splice(idx, 1);
        idx = connectionArray.findIndex((element) => {return element.name === newConnect.name});

    }

    connectionArray.push(newConnect);
}

function getConnectionForName(name) {
    var connect = null;
    var i;

    for (i=0; i<connectionArray.length; i++) {
        if (connectionArray[i].name === name) {
            connect = connectionArray[i];
            break;
        }
    }

    return connect;
}

function makeUserListMessage() {
    var userListMsg = {
        type: "user-list",
        users: []
    };
    var i;

    for (i=0; i<connectionArray.length; i++) {
        userListMsg.users.push(connectionArray[i].name);
    }

    return userListMsg;
}

function sendUserListToAll() {
    var userListMsg = makeUserListMessage();
    var userListMsgStr = JSON.stringify(userListMsg);
    var i;

    for (i=0; i<connectionArray.length; i++) {
        connectionArray[i].send(userListMsgStr);
    }
}

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", function connection(ws) {
    log("Incoming connection...");


    connectionArray.push(ws);
    ws.clientID = nextID;
    ws.caller = false;
    nextID++;

    var msg = {
        type: "greeting",
        id: ws.clientID
    };
    ws.send(JSON.stringify(msg));
    log('init message sent');

    ws.on("message", function(message) {
        var msg = JSON.parse(message);
        var connect;

        switch(msg.type) {
            case "greeting":
                ws.name = msg.name;
                ws.caller = false;
                insertUser(ws);
                sendUserListToAll();
                break;

            case "new-ice-candidate":
                connect = getConnectionForName(msg.target);
                connect?.send(message);
                break;

            case "video-offer":
                log('video offer target: ' + msg.target);
                ws.caller = true;
                connect = getConnectionForName(msg.target);
                if (connect && !connect.caller) {
                    connect?.send(message);
                }
                break;

            case "video-answer":
                connect = getConnectionForName(msg.target);
                connect?.send(message);
                break;
        }

    });


    ws.on('close', function(reason, description) {
        connectionArray = connectionArray.filter(function(el, idx, ar) {
            return el.connected;
        });

        var logMessage = "Connection closed: " + ws.remoteAddress + " (" +
            reason;
        if (description !== null && description.length !== 0) {
            logMessage += ": " + description;
        }
        logMessage += ")";
        log(logMessage);
    });

});


