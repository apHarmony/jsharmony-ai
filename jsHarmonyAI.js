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
var jsHarmonyModule = require('jsharmony/jsHarmonyModule');
var jsHarmonyAI_Config = require('./jsHarmonyAI.Config.js');
var jsHarmonyAI_VectorDb = require('./jsHarmonyAI.VectorDb.js');
var jsHarmonyAI_ChatServer = require('./jsHarmonyAI.ChatServer.js');
var OpenAI = require('openai');
var fs = require('fs');
var _ = require('lodash');
var path = require('path');

function jsHarmonyAI(name, options){
  options = _.extend({
    schema: 'jsharmony',
  }, options);

  var _this = this;
  jsHarmonyModule.call(this, name);
  _this.Config = new jsHarmonyAI_Config();

  if(name) _this.name = name;
  _this.typename = 'jsHarmonyAI';

  _this.schema = options.schema;
  _this.existingSchema = options.existingSchema;

  this.VectorDb = jsHarmonyAI_VectorDb(this);
  this.ChatServer = jsHarmonyAI_ChatServer(this);

  this._ai = null;
  this.getAI = function(){
    if(!_this._ai) _this._ai = new OpenAI({ apiKey: _this.Config.OpenAI.apiKey });
    return _this._ai;
  };

  this.chatFuncs = {
    result_string: {
      description: 'Return a result as a string',
      parameters: {
        type: 'object',
        properties: {
          result: { type: 'string', description: 'Result' },
        },
        required: ['result'],
      },
      exec: function(result){
        return result;
      },
    },
    result_string_arr: {
      description: 'Return a result as a string array',
      parameters: {
        type: 'object',
        properties: {
          result: { 'type': 'array', 'items': { 'type': 'string' }, description: 'Result' },
        },
        required: ['result'],
      },
      exec: function(result){
        return result;
      },
    },
    result_number: {
      description: 'Return a result as a number',
      parameters: {
        type: 'object',
        properties: {
          result: { type: 'number', description: 'Result' },
        },
        required: ['result'],
      },
      exec: function(result){
        return result;
      },
    },
    result_bool: {
      description: 'Return a result as a boolean',
      parameters: {
        type: 'object',
        properties: {
          result: { type: 'boolean', description: 'Result' },
        },
        required: ['result'],
      },
      exec: function(result){
        return result;
      },
    },
  };

  this.getLogPath = function(){
    return path.join(_this.jsh.Config.logdir,'ai-'+(new Date().getTime()).toString()+'.txt');
  };

  this.appendLog = function(txt){
    var logPath = _this.getLogPath();
    fs.appendFileSync(logPath,txt);
  };

  this.req = async function(messages, reqOptions){
    if(_.isString(messages)) messages = [messages];
    if(!_.isArray(messages)) messages = [messages];
    for(var i=0;i<messages.length;i++){
      var message = messages[i];
      if(_.isString(message)) message = { content: [{ type: 'text', text: message }] };
      if(!message.role) message.role = 'user';
      messages[i] = message;
    }
    
    var req = _.extend({
      model: 'gpt-4o',
      messages: messages,
    }, reqOptions);
  
    _this.appendLog('>>>>>>>>>>>>>>>>>>>>>>>>>>\r\n'+JSON.stringify(req,null,4)+'\r\n');
    var res = await _this.getAI().chat.completions.create(req);
    _this.appendLog('<<<<<<<<<<<<<<<<<<<<<<<<<<\r\n'+JSON.stringify(res,null,4)+'\r\n');
    return res;
  };

  this.prompt = async function(messages){
    var res = await _this.req(messages);
    return res.choices[0].message.content;
  };

  this.promptImage = async function(message){
    var req = {
      model: 'dall-e-3',
      prompt: message,
    };
    var res = await _this.getAI().images.generate(req);
    return res.data[0].url;
  };

  this.getChatFuncs = function(funcNames, chatFuncs){
    if(!chatFuncs) chatFuncs = _this.chatFuncs;
    funcNames = funcNames || _.keys(chatFuncs);
    var tools = [];
    _.each(funcNames, function(key){
      var chatFunc = chatFuncs[key];
      if(!chatFunc) throw new Error('Chat function '+key+' not found');
      tools.push({
        type: 'function',
        function: {
          name: key,
          description: chatFunc.description,
          parameters: chatFunc.parameters,
        }
      });
    });
    return tools;
  };

  this.callChatFunc = function(resToolCall){
    var funcName = resToolCall.function.name;
    var chatFunc = _this.chatFuncs[funcName];
    var args = JSON.parse(resToolCall.function.arguments);
    var params = [];
    for(var argName in chatFunc.parameters.properties){
      params.push(args[argName]);
    }
    var rslt = chatFunc.exec.apply(this, params);
    return rslt;
  };

  this.typedPrompt = async function(promptType /* string, string_arr, number, bool */, messages){
    promptType = promptType || 'string';
    if(_.isString(messages)) messages = [messages];
    if(!_.isArray(messages)) messages = [messages];
    messages = messages.concat([{
      role: 'system',
      content: "Call the 'result_"+promptType+"' function with the result when done",
    }]);
    var res = await _this.req(messages, {
      tools: _this.getChatFuncs(['result_'+promptType]),
      tool_choice: 'required',
    });
    return _this.callChatFunc(res.choices[0].message.tool_calls[0]);
  };

  this.typedMultiPrompt = async function(promptType /* string, string_arr, number, bool */, messages){
    promptType = promptType || 'string';
    if(_.isString(messages)) messages =[messages];
    if(!_.isArray(messages)) messages = [messages];
    messages = messages.concat([{
      role: 'system',
      content: "Call the 'result_"+promptType+"' function with the result when done",
    }]);
    var res = await _this.req(messages, {
      tools: _this.getChatFuncs(['result_'+promptType]),
      tool_choice: 'auto',
    });
    var resMsg = res.choices[0].message;
    if(resMsg.tool_calls){
      return { res: res, result: _this.callChatFunc(resMsg.tool_calls[0]) };
    }
    else {
      return { res: res, chat: res.choices[0].message.content };
    }
    
  };

  this.getEmbedding = async function(text) {
    var res = await _this.getAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    _this.appendLog(JSON.stringify(res.data));
    return res.data.map(item => item.embedding);
  };
}

jsHarmonyAI.prototype = new jsHarmonyModule();

module.exports = exports = jsHarmonyAI;
