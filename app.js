var express = require('express');
var app = express();
var http = require('http');
var url = require('url');
var colors = require('colors');
var redis = require('redis');
var redisClient = redis.createClient(10885, "barreleye.redistogo.com");
var dbAuth = function() {redisClient.auth('9a33157669eb64a75fe81c630cd28c66');}
dbAuth();
var request = require('request');
var socket = require('socket.io');
var server = http.createServer(app);
var io = socket.listen(server, {log: false});

app.use(express.static(__dirname+"/styles"));
app.set('view engine', 'ejs');

function pushMessage(name,message){
  var savedMessage = JSON.stringify({name: name, message: message})
  redisClient.lpush("messages", savedMessage, function(err, reply){
    redisClient.ltrim("messages", 0, 9);
    console.log((reply-1) + " messages stored in redis");
  });
};

server.listen(3000, function(){
	console.log('Server started on port 3000');
})

io.sockets.on('connection', function(client){
	console.log('Client connected'.blue.underline);

  client.on('join', function(name){
    console.log(name.grey+' has joined');
    client.set('name', name);
    client.emit('addClient', name);
    client.broadcast.emit('addClient', name);

    redisClient.lrange("messages", 0, -1, function(err, messages){
      messages = messages.reverse();
     
      messages.forEach(function(message){
        message = JSON.parse(message);
        client.emit("addMessage", message);
        console.log("This is a stored message:" + message['name']+" " + message['message']);
      });
    //lrange end
    });
  //join end
  });
 
  client.on('messages', function (data){
    client.get('name', function(err, name){
      console.log(name.grey + " says "+data.green);
      client.emit('addMessage', {message: data, name:name});
      client.broadcast.emit('addMessage', {message: data, name: name});
      pushMessage(name,data)
    });
	});

  client.on ('disconnect', function(data){
    console.log("Client disconnected");
  });

});

app.get('/', function(request, response){
  response.render('index');
  response.end();
});

app.get('/stuff/:username',function(req, response){
  var username = req.params.username;
  response.render('stuff', {name: username});
  response.end();
});
 