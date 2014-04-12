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
//Heroku ports
var port = Number(process.env.PORT || 5000);


app.use(express.static(__dirname+"/styles"));
app.set('view engine', 'ejs');

function pushMessage(name,message){
  var savedMessage = JSON.stringify({name: name, message: message})
  redisClient.lpush("messages", savedMessage, function(err, reply){
    redisClient.ltrim("messages", 0, 9);
    console.log((reply-1) + " messages stored in redis");
  });
};

function pushClient(name){
  redisClient.sadd("clients", name, function(err, reply){
    console.log(reply);
  });
}
//reset client list on server reset
resetClientList = function(){
  redisClient.smembers('clients', function(err, reply){
   reply.forEach(function(name){
     redisClient.srem('clients', name, function(err, reply){
       if(err){console.log(err);}
     });
   }); 
  });
}

server.listen(port, function(){
	console.log('Listening on ' + port);
  resetClientList();
});

io.sockets.on('connection', function(client){
	console.log('Client connected'.blue.underline);

  client.on('join', function(name){
    console.log(name.grey+' has joined');
    client.set('name', name);
    pushClient(name);
   
     redisClient.smembers("clients", function(err,users){
       users.forEach(function(user){
         client.emit('addClient', user);
         client.broadcast.emit('addClient', user);  
       });
     });
    

    redisClient.lrange("messages", 0, -1, function(err, messages){
      messages = messages.reverse();
      console.log("Loaded old messages :\n")
      messages.forEach(function(message){
        message = JSON.parse(message);
        client.emit("addMessage", message);
        console.log( message.name.grey+" said " + message.message);
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
    client.get("name", function(err, name){
      console.log(name+" has disconnected");
      redisClient.srem("clients", name, function(err,reply){
       if(err){console.log(err);}
       client.broadcast.emit("clientDisconnect", {name: name});
      });
    });
  });

});

app.get('/', function(request, response){
  response.render('index');
  response.end();
});