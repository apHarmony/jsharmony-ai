/*
Copyright 2024 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

var Helper = require('jsharmony/Helper');
var express = require('jsharmony/lib/express');
var http = require('http');
var WebSocket = require('ws');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');

exports = module.exports = function(jsHarmonyAI){
  return function(options){
    var _this = this;
    var lastClientId = 0;
    var clients = [
      //{ session, messageHistory }
    ];

    this.port = jsHarmonyAI.Config.ChatServer.port;
    this.onSessionStart = []; /* function(client){} */
    this.onMessage = []; /* function(client, message){} */
    this.serverId = new Date().getTime();

    this.broadcast = function(userName, txt, options) {
      _.each(clients, function(client){
        _this.send(client, userName, txt, options);
      });
    };

    this.getLogPath = function(client){
      return path.join(jsHarmonyAI.jsh.Config.logdir,'chat-'+_this.serverId.toString()+'-'+client.id.toString()+'.txt');
    };
  
    this.appendLog = function(client, txt){
      var logPath = _this.getLogPath(client);
      fs.appendFileSync(logPath,txt);
    };

    this.send = function(client, userName, txt, options){
      var msg = { user: userName, text: txt };
      if(options) for(var key in options) msg[key] = options[key];
      client.messageHistory.push(msg);
      
      if (client.session.readyState === WebSocket.OPEN) {
        client.session.send(JSON.stringify(msg));
        _this.appendLog(client, JSON.stringify(msg)+'\n');
      }
    };

    this.getSessionVarText = function(client){
      var varArr = [];
      for(var key in client.vars){
        if(key[0]=='$') continue;
        var val = client.vars[key];
        var valTxt = val.toString();
        if(_.isArray(val)) valTxt = val.join(', ');
        else if(_.isBoolean(val)) valTxt = val ? 'true' : 'false';
        varArr.push(key + ': ' + valTxt);
      }
      return varArr.join('\n');
    };
    
    this.run = function(options){
      options = _.extend({ defaultChatScript: null, onReady: null, defaultVars: null }, options);
      var app = express();
      app.use(express.static(path.join(jsHarmonyAI.Config.moduledir,'www-chat')));
      var server = http.createServer(app);

      var wss = new WebSocket.Server({ server });
      wss.on('connection', (session) => {
        var client = {
          id: ++lastClientId,
          session: session,
          vars: options.defaultVars || {},
          aiMessageLog: {},
          messageHistory: [],
          chatScript: null,
          chatScriptIdx: null,
        };
        client.send = function(userName, txt, options){ return _this.send(client, userName, txt, options); };
        client.getSessionVarText = function(){ return _this.getSessionVarText(client); };
        client.continueChatScript = function(){ return _this.continueChatScript(client); };

    
        clients.push(client);
        console.log('Client connected');

        session.on('message', (message) => {
          message = message.toString();
          _this.send(client, 'user', message);
          Helper.trigger(_this.onMessage, client, message);
          if(client.chatScript) _this.chatScript_onReply(client, message);
        });

        session.on('close', () => {
          for(var i=0;i<clients.length;i++){
            if(clients[i]==client) clients.splice(i--, 1);
          }
          console.log('Client disconnected');
        });
        
        Helper.trigger(_this.onSessionStart, client);

        if(options.defaultChatScript) _this.startChatScript(client, options.defaultChatScript);
      });
      
      server.listen(_this.port, () => {
        console.log('Chat Server is listening on port '+_this.port);
        if(options.onReady) options.onReady();
      });
    };

    this.startChatScript = function(client, chatScript){
      client.chatScript = chatScript;
      _this.continueChatScript(client);
    };

    this.continueChatScript = async function(client){
      if(client.chatScriptIdx === null) client.chatScriptIdx = 0;
      else client.chatScriptIdx++;
      if(client.chatScriptIdx >= client.chatScript.length){
        client.send('system','Done');
        return;
      }
      var curOp = client.chatScript[client.chatScriptIdx];
      if(curOp.prompt){
        await _this.chatScript_prompt(client, curOp);
      }
      else if(curOp.synthesize){
        await _this.chatScript_synthesize(client, curOp);
      }
      else if(curOp.exec){
        await _this.chatScript_exec(client, curOp);
      }
      else if(curOp.chat){
        await _this.chatScript_chat(client, curOp);
      }
      else throw new Error('Unsupported chat operation: '+JSON.stringify(curOp));
    };

    this.chatScript_prompt = async function(client, curOp){
      client.aiMessageLog = [
        {
          role: 'system',
          content: 'You are a chatbot.  '+curOp.instruction+", and call the 'result_"+(curOp.format||'string')+"' function with the result when done.  So far, you have the following information\n" + client.getSessionVarText(),
        },
        {
          role: 'assistant',
          content: curOp.prompt,
        },
      ];
      client.send('assistant',curOp.prompt);
    };
    
    this.chatScript_synthesize = async function(client, curOp){
      if(!curOp.format) curOp.format = 'string';
      var rslt = await jsHarmonyAI.typedPrompt(curOp.format, curOp.synthesize+'.  You have the following information\n' + client.getSessionVarText());
      if(!_.isArray(curOp.key)) curOp.key = [curOp.key];
      _.each(curOp.key, function(key){ client.vars[key] = rslt; });
      client.continueChatScript();
    };
  
    this.chatScript_exec = async function(client, curOp){
      await curOp.exec(client);
    };

    this.chatScript_chat = async function(client, curOp){
      client.send('assistant',curOp.chat);
      client.continueChatScript();
    };

    this.chatScript_onReply = async function(client, message){
      if(client.chatScriptIdx >= client.chatScript.length) return;
      var curOp = client.chatScript[client.chatScriptIdx];
      if(curOp.prompt){
        client.aiMessageLog.push({
          role: 'user',
          content: [{ type: 'text', text: message }],
        });
        var rslt = await jsHarmonyAI.typedMultiPrompt(curOp.format, client.aiMessageLog);
        if(rslt.result){
          if(!_.isArray(curOp.key)) curOp.key = [curOp.key];
          _.each(curOp.key, function(key){ client.vars[key] = rslt.result; });
          return client.continueChatScript();
        }
        else if(rslt.chat){
          client.aiMessageLog.push(rslt.res.choices[0].message);
          client.send('assistant',rslt.chat);
        }
      }
    };

    this.applyTemplate = function(txt, params){
      txt = (txt || '').toString();
      params = params || {};
      var allKeys = _.keys(params);
      allKeys.sort(function(a,b){
        if(a.length > b.length) return -1;
        if(a.length < b.length) return 1;
        return 0;
      });
      _.each(allKeys, function(key){
        var val = params[key];
        var valTxt = val.toString();
        if(_.isArray(val)) valTxt = val.join(', ');
        txt = txt.split('%%%'+key+'%%%').join(valTxt);
      });
      return txt;
    };
  };
};