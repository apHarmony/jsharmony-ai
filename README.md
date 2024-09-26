# ============
# jsharmony-ai
# ============

AI extensions for jsHarmony

## Installation

```
npm install jsharmony-ai
```

Then, in app.config.js or app.config.local.js, initialize the module:

```
var jsHarmonyAI = require('jsharmony-ai');

exports = module.exports = function(jsh, config, dbconfig){
  jsh.AddModule(new jsHarmonyAI());

  var configAI = config.modules['jsHarmonyAI'];
  if (configAI) {
    configAI.OpenAI.apiKey = '...';
  }
}
```

## Text Prompt
```
var jsHarmonyAI = jsh.Modules['jsHarmonyAI'];
var rslt = await jsHarmonyAI.prompt('How has Artificial Intelligence advanced over the years?');
```

## Typed Prompt
A typed prompt can return a "number", "string", "string_arr", or "bool"
```
var jsHarmonyAI = jsh.Modules['jsHarmonyAI'];
var rslt = await jsHarmonyAI.typedPrompt('number', 'How many bytes are in a kilobyte?  Please only return the number by itself.');
```

## Chat Bot
```
var jsHarmonyAI = jsh.Modules['jsHarmonyAI'];
var chatServer = new jsHarmonyAI.ChatServer();
var chatScript = [
  //Message
  { chat: 'Welcome to the coffee bot.' },

  //User Prompt
  { prompt: 'What is your favorite coffee?', key: 'Favorite Coffee', instruction: 'Keep asking until the user provides their favorite coffee.  Return only the type of coffee', },

  //Information Synthesis
  { synthesize: 'Determine the answer to the following question: What are similar coffees the user might enjoy?', format: 'string_arr', key: '$Similar Coffee' },

  //Custom Functions & Report Generation
  {
    exec: async function(client){
      var coffeeReport = chatServer.applyTemplate(fs.readFileSync('./reportTemplate.txt').toString(), client.vars);
      client.send('assistant','Please find your customized coffee report below:');
      client.send('assistant','\n'+coffeeReport, { format: 'pre' });
      client.continueChatScript();
    }
  },
];
var defaultVars = {
  'Coffee Shop': "Jake's Coffee",
};
chatServer.run({ defaultChatScript: chatScript, defaultVars: defaultVars });
```

## Image Generation
```
var jsHarmonyAI = jsh.Modules['jsHarmonyAI'];
var url = await jsHarmonyAI.promptImage('Draw a futuristic mainframe computer');
require('child_process').exec('"c:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" "'+url+'"');
```

## Vector Database Indexing
```
var jsHarmonyAI = jsh.Modules['jsHarmonyAI'];
var vectorDb = await new jsHarmonyAI.VectorDb({
  getEmbedding: async function(content){ return await (await jsHarmonyAI.getEmbedding(content))[0]; },
  fields: {
    page: 'number',
    title: 'string',
  }
});
await vectorDb.index(pages[0], { title: 'jsHarmony Tutorials', page: 1 });
await vectorDb.index(pages[1], { title: 'jsHarmony Tutorials', page: 2 });
await vectorDb.save();
```

## Vector Database Search
```
var vectorDb = await new jsHarmonyAI.VectorDb({
  getEmbedding: async function(content){ return (await jsHarmonyAI.getEmbedding(content))[0]; }
});
var rslt = await vectorDb.searchVector('What animal does Ursus fight?',{
  where: { title: 'How can I define a grid model?' }
         // or { numericField: { eq: value } }
});
```