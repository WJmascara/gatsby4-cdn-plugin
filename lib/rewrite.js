const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const { PUBLIC_PATH, PUBLIC_APP_PATH, PUBLIC_WEBPACK_RUNTIME_PATH } = require('./vars');
const { readFile, writeFile, asyncGlob } = require('./utils');

/**
 * @description json文件上传cdn之后，需要在app.js中做路径替换
 * @description 替换类型一：页面page-data.json文件
 * @description 替换类型二：公共全局数据对应的json文件，如/page-data/sq/d/
 * @description app-data.json文件
 * @param {Object} uploadedData json对象
 */

async function rewriteAppJs(uploadedData) {
  try {
    const jsCode = await readFile(PUBLIC_APP_PATH, 'utf-8');
    const astCode = parser.parse(jsCode);
    const chunkMap = shortPath(uploadedData);
    const pageDataObj = {};    // {pathname: page-data.json对应的cdn路径}
    const sqDataObj = {};      // {/page-data/sq/d/123: 此文件对应的cdn路径}
    chunkMap.forEach((val, key) => {
      if (key.indexOf('page-data.json') > -1) {

        // 页面pathname
        const pathname = key.replace('/page-data.json', '').replace('app-data.json', '').replace('/page-data', '');
        pageDataObj[pathname] = val;
      }
      if (key.indexOf('/page-data/sq/d/') > -1) {
        sqDataObj[key]  = val;
      }
    });

    const replacePageData = (path) => {
      while (path.node.type !== 'FunctionExpression') {
        path = path.parentPath;
      }

      // 对应函数的参数
      const p = path.node.params[0].name;

      // 替换的值
      let replacePageJSON = '{';
      Object.keys(pageDataObj).map((m) => {
        replacePageJSON += `"${m}":'${pageDataObj[m]}',`;
      });
      replacePageJSON = replacePageJSON.substr(0, replacePageJSON.length - 1);
      replacePageJSON += '}';

      // 替换的函数体
      const replaceJS = `{return (function(${p}) {
        let [pathname, search] = ${p}.split('?');
        if (pathname === '/') {pathname += 'index'}
        return ${replacePageJSON}[pathname] + (search ? '?' + search : '');
      }(${p}))}`;
      path.node.body = parser.parse(replaceJS, { allowReturnOutsideFunction: true });
    };

    const replaceSqData = (path) => {

      // 对应参数
      const p = path.parentPath.node.right.name;
      while (path.node.type !== 'CallExpression') {
        path = path.parentPath;
      }

      let replaceJson = '{';
      Object.keys(sqDataObj).map((m) => {
        replaceJson += `"${m}":'${sqDataObj[m]}',`;
      });
      replaceJson = replaceJson.substr(0, replaceJson.length - 1);
      replaceJson += '}';

      const replaceJS = `(${replaceJson}['/page-data/sq/d/' + ${p} + '.json'])`;
      const replaceAst = parser.parse(replaceJS);

      // 避免generate时出现分号，所以获取ast节点的时候得注意
      path.node.arguments[0] = replaceAst.program.body[0].expression;
    };

    const replaceAppData = (path) => {
      path.node.value = chunkMap.get(path.node.value);
    }

    traverse(astCode, {
      enter(path) {
        if (path.node.type === 'StringLiteral' && path.node.value === '/page-data/') {
          replacePageData(path);
        }

        if (path.node.value === '/page-data/app-data.json') {
          replaceAppData(path);
        }

        if (path.node.value === '/page-data/sq/d/' && Object.keys(sqDataObj).length) {
          replaceSqData(path);
        }
      },
    });

    // 重新写入app.js
    const newJsCode = generate(astCode, { minified: true }).code;
    await writeFile(PUBLIC_APP_PATH, newJsCode, 'utf-8');
  } catch (err) {
    console.error(err);
    return err;
  }
};

/**
 * @description 替换webpack.runtime.js中静态资源的路径
 * @param {Object} uploadedData json对象
 */

async function rewriteWebpackRuntimeJs(uploadedData) {
  try {
    let webpackRuntimeJS = await readFile(PUBLIC_WEBPACK_RUNTIME_PATH, 'utf-8');
    const chunkMap = shortPath(uploadedData);
    const styleCSSCDN = chunkMap.get('/styles.css');

    // css路径替换
    webpackRuntimeJS = webpackRuntimeJS.replace(
      'styles.css',
      styleCSSCDN.substr(6),
    );

    // js路径替换
    chunkMap.forEach((val, key) => {
      const name = key.replace(/^\/(.*)\.js$/, '$1')
      webpackRuntimeJS = webpackRuntimeJS.replace(new RegExp(name, 'g'), val.substr(6).replace('.js', ''));
    });

    // 重新写入webpack-runtime.js文件
    await writeFile(PUBLIC_WEBPACK_RUNTIME_PATH, webpackRuntimeJS, 'utf-8');
  } catch (err) {
    console.error(err);
    return err;
  }
}

/**
 * @description 替换html中静态资源的路径
 */

async function rewriteHtml(allUploadedData) {
  const allHTMLFiles = await (async () => {
    const { globbySync } = await import('globby')
    const files = globbySync([`${PUBLIC_PATH}/**/*.html`])
    return files
  })()
  const chunkMap = shortPath(allUploadedData);

  return Promise.all(allHTMLFiles.map(async (htmlPath) => {
    try {

      // 滤掉public/page-data/404.html
      if (htmlPath.indexOf('page-data') > -1) {
        return;
      }
      let content = await readFile(htmlPath, 'utf-8');
      chunkMap.forEach((val, key) => {
        content = content.replace(new RegExp(key, 'g'), val);
      });
      await writeFile(htmlPath, content, 'utf-8');
    } catch (e) {
      console.error(e);
    }
  }));
}

/**
 * @description 截掉路径前缀和后面md5串
 * @param {Object} obj json对象
 * @returns {Map} map对象
 */

function shortPath(obj) {
  const chunkMap = new Map();
  for (key of Object.keys(obj)) {
    const newKey = key.replace(PUBLIC_PATH, '').replace(/^(.*\.[json|css|js|png]*)\/.*$/, '$1');
    chunkMap.set(newKey, obj[key]);
  }
  return chunkMap;
}

module.exports = {
  rewriteAppJs,
  rewriteWebpackRuntimeJs,
  rewriteHtml
};