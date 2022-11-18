# gatsby4-cdn-plugin
A Gatsby4 plugin which parsing assets of public,which is js or css or json or png, upload it to cdn and replace the source of html | app.js | webpackRuntime.js

## Options
### `uploader` 

- **Type:** `function(filePath):<Promise>`
- **Default:**
  ```js
  (filePath) => {
    return Promise.resolve("");
  };
  ```
  your cdn upload function with filePath. the funtion return a Promise with final url resolved