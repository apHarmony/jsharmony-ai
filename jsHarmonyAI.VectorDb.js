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

var orama = require('@orama/orama');
var fs = require('node:fs/promises');
var _ = require('lodash');

exports = module.exports = function(jsHarmonyAI){
  return function(options){
    options = _.extend({
      getEmbedding: async function(content){ throw new Error('Please define the VectorDb options.getEmbedding function'); },
      fields: {},
      config: {},
    }, options);

    var _this = this;

    this._db = null;

    this.getDbPath = function(){
      return jsHarmonyAI.Config.VectorDb.path;
    };

    this.getDb = function(){
      return _this._db;
    };

    this.getEmbedding = async function(content){ return options.getEmbedding(content); };

    this.load = async function(){
      _this._db = await orama.create(_.extend({
        schema: _.extend({
          content: 'string',
          embedding: 'vector[1536]',
        }, options.fields)
      }, options.config));
      if((await fs.stat(_this.getDbPath()).catch(function(e){ return false; }))){
        await orama.load(_this._db, JSON.parse(await fs.readFile(_this.getDbPath(),'utf8')));
      }
      return this;
    };

    this.save = async function(){
      await fs.writeFile(_this.getDbPath(), JSON.stringify(await orama.save(_this._db)), 'utf8');
    };

    this.index = async function(content, fieldData){
      await orama.insert(_this._db, _.extend({
        content: content,
        embedding: await _this.getEmbedding(content),
      }, fieldData));
    };

    this.indexEmbedding = async function(content, fieldData, embedding){
      await orama.insert(_this._db, _.extend({
        content: content,
        embedding: embedding,
      }, fieldData));
    };

    this.searchText = async function(searchParams){
      if(_.isString(searchParams)) searchParams = { term: searchParams };
      searchParams = _.extend({
        similarity: 0,
        limit: 10,
      }, searchParams);
      return await orama.search(_this._db, searchParams);
    };

    this.searchHybrid = async function(searchQuery, searchParams){
      return await orama.search(_this._db, _.extend({
        mode: 'hybrid',
        vector: {
          value: (_.isArray(searchQuery) ? searchQuery : (await _this.getEmbedding(searchQuery))),
          property: 'embedding'
        },
        similarity: 0,
        limit: 3,
      }, searchParams));
    };

    this.searchVector = async function(searchQuery, searchParams){
      return await orama.searchVector(_this._db, _.extend({
        vector: {
          value: await _this.getEmbedding(searchQuery),
          property: 'embedding'
        },
        similarity: 0,
        limit: 3,
      }, searchParams));
    };

    this.searchVectorEmbedding = async function(embedding){
      return await orama.searchVector(_this._db, {
        mode: 'vector',
        vector: {
          value: embedding,
          property: 'embedding'
        },
        similarity: 0,
        limit: 3,
      });
    };

    return _this.load();
  };
};