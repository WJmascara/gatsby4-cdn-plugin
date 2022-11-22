const process = require('process');
const cliProgress = require('cli-progress');
const colors = require('ansi-colors');
const { PUBLIC_PATH, PUBLIC_APP_PATH, PUBLIC_WEBPACK_RUNTIME_PATH, UPLOAD_MANIFEST_PATH } = require('./vars');
const { md5File, readFile, writeFile } = require('./utils');
const { rewriteAppJs, rewriteWebpackRuntimeJs, rewriteHtml } = require('./rewrite');
const pluginOptions = {}

/**
 *
 * @description gatsby构建完成之后执行的函数
 * @description 静态资源增量上传cdn
 * @description 资源文件路径替换
 * @description 生成upload.manifest.json文件
 * @param {Object} pluginOptions插件参数
 *
 */

async function onPostBuild(options) {
  Object.assign(pluginOptions, options)
  try {

    // 获取增量文件和缓存json
    const filters = await filterIncrementFiles();
    const { cacheJSON, toUploadFiles } = filters;

    // 上传除app.js/webpack-runtime.js以外的文件
    const otherFiles = toUploadFiles.filter(item => item !== PUBLIC_APP_PATH && item !== PUBLIC_WEBPACK_RUNTIME_PATH);
    const uploadedOther = otherFiles.length ? await upload(pluginOptions.uploader, otherFiles) : {};

    // 重写App.js/webpack-runtime.js
    const current = { ...cacheJSON, ...uploadedOther };
    await rewriteAppJs(current);
    await rewriteWebpackRuntimeJs(current);

    // 重新上传App.js/webpack-runtime.js
    const uploadedRewrite = await upload(pluginOptions.uploader, [PUBLIC_APP_PATH, PUBLIC_WEBPACK_RUNTIME_PATH]);

    // 上传完cdn的所有静态资源文件
    const allJSON = { ...cacheJSON, ...uploadedOther, ...uploadedRewrite };

    //重写html
    await rewriteHtml(allJSON);

    // 写入upload.manifest.json文件
    await writeFile(UPLOAD_MANIFEST_PATH, JSON.stringify(allJSON));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

/**
 *
 * @description upload 上传文件
 * @param {Object} uploader 上传函数
 * @param {Array} filePaths 待上传的文件地址数组
 *
 */
async function upload(uploader, filePaths) {
  const uploadCDN = filePath => new Promise(async (resolve, reject) => {
    let i = 0;
    const retry = 5
    while (i < retry) {
      try {
        const res = await uploader(filePath);
        const key = Object.keys(res)[0];
        const val = Object.values(res)[0];
        resolve({ key, val });
        break;
      } catch (e) {
        console.error(
          `retry ${filePath} ${i + 1} times because of ${e.message}`,
        );
        i++;
      }
    }
    if (i === retry) {
      reject(new Error(`retry ${retry} times has exceeded`));
    }
  });
  
  const obj = {};

  // 设置上传进度条
  const bar = new cliProgress.SingleBar(
    {
      format: colors.green('上传进度 [{bar}] {percentage}% | 预计: {eta}s | {value}/{total}')
    },
    cliProgress.Presets.rect,
  );
  bar.start(filePaths.length, 0);

  for (file of filePaths) {
    try {
      const { val } = await uploadCDN(file);
      const key = `${file}/${await md5File(file)}`;
      obj[key] = val;
      bar.increment();
    } catch (e) {
      console.error(e);
      process.exit(1)
    }
  }
  bar.stop();
  return obj;
}


/**
 * @description 获取public下所有静态资源文件
 * @returns {Array} 路径数组
 */

async function gatherStaticFiles() {
  return (async () => {
    const { globbySync } = await import('globby')
    const files = globbySync([`${PUBLIC_PATH}/**/*.?(js|css|json)`, `!${PUBLIC_PATH}/~partytown/**`])
    return files
  })()
};

/**
 * @description 筛选出待上传文件
 * @returns {Object} cacheJSON:旧数据，toUploadFiles：待上传文件
 */

async function filterIncrementFiles() {
  try {

    // 获取public下所有静态文件
    const allStaticFiles = await gatherStaticFiles();

    // 读取manifest.upload.json文件内容
    let cache = await readFile(UPLOAD_MANIFEST_PATH);
    let cacheJSON = cache ? JSON.parse(cache) : {};
    const toUploadFiles = [];

    // 首次上传
    if (Object.keys(cacheJSON).length === 0) {
      return {
        cacheJSON: {},
        toUploadFiles: allStaticFiles
      };
    }

    // 增量文件
    for (file of allStaticFiles) {
      const newKey = `${file}/${await md5File(file)}`;
      if (!cacheJSON[newKey]) {
        toUploadFiles.push(file);
      }
    }

    return {
      cacheJSON: { ...deleteOldPaths(toUploadFiles, cacheJSON) },
      toUploadFiles,
    };
  } catch (err) {
    console.error(err);
    return err;
  }
}

/**
 * @description 删除对象中变更的路径条目
 * @param {Object} filePaths 路径数组
 * @param {Object} obj 待操作对象
 * @returns {Object} 删除后的对象
 */

function deleteOldPaths(filePaths, obj) {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    filePaths.forEach(path => {
      if (key.indexOf(path) > -1) {
        delete newObj[key];
      }
    });
  });
  return newObj;
}

module.exports = onPostBuild;





