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

var jsHarmonyConfig = require('jsharmony/jsHarmonyConfig');
var path = require('path');

function jsHarmonyAI_Config(){
  //Module path
  this.moduledir = path.dirname(module.filename);

  //OpenAI Configuration
  this.OpenAI = {
    apiKey: '',
  };

  //VectorDb
  this.VectorDb = {
    path: ''
  };

  this.ChatServer = {
    port: 3100,
  };
}

jsHarmonyAI_Config.prototype = new jsHarmonyConfig.Base();

jsHarmonyAI_Config.prototype.Init = function(cb, jsh){
  if(!this.VectorDb.path) this.VectorDb.path = path.join(jsh.Config.datadir,'db','vdb.msp');

  if(cb) return cb();
};

exports = module.exports = jsHarmonyAI_Config;