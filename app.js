var express = require('express');
var app = express();
var http = require('http');
var url = require('url');
var colors = require('colors');
var redis = require('redis');
var redisClient = redis.createClient(10885, "redis://redistogo:9a33157669eb64a75fe81c630cd28c66@barreleye.redistogo.com");
var request = require('request');
var socket = require('socket.io');
var server = http.createServer(app);
var io = socket.listen(server, {log: false});

app.use(express.static(__dirname+"/styles"));
app.set('view engine', 'ejs');

function pushMessage(socket,name,message){
  var savedMessage = JSON.stringify({name: name, message: message})
  socket.lpush("messages", savedMessage, function(err, reply){
    socket.ltrim("messages", 0, 10);
    console.log(reply + " messages stored in redis");
  });
};

server.listen(3000, function(){
	console.log('Server started on port 3000');
})

io.sockets.on('connection', function(client){
	console.log('Client connected'.blue.underline);

  client.on('join', function(name){
    console.log(name+' has joined');
    client.set('name', name);
    client.emit('addClient', name);
    client.broadcast.emit('addClient', name);

    redisClient.lrange("messages", 0, -1, function(err, messages){
      messages = messages.reverse();
     
      messages.forEach(function(message){
        message = JSON.parse(message);
        client.emit("messages", message.name+ ":" + message.data);
      });
    //lrange end
    });
  //join end
  });
 
	client.on('messages', function (data){
    client.get('name', function(err, name){
      console.log(name.grey + " says "+data.green);
      client.emit('addMessage', {add: data, name:name});
      client.broadcast.emit('addMessage', {add: data, name: name});
      pushMessage(client,name,message)
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
 