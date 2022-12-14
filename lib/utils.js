const fs = require('fs');
const md5 = require('md5');
const { promises } =  fs;

/**
 * @description 异步读取文件
 * @param {String} path 文件路径
 * @param {Object} options 参数对象，同node.js的fs.readFile
 * @returns 文件内容
 */

async function readFile(path, options) {
  try {
    if (!fs.existsSync(path)) {
      return null;
    }
    return await promises.readFile(path, options);
  } catch (err) {
    return err;
  }
}

/**
 * @description 异步写入文件内容
 * @param {*} path 文件路径
 * @param {*} data 待写入内容
 * @param {*} options 参数对象，同node.js的fs.writeFile
 */

async function writeFile(path, data, options) {
  try {
    await promises.writeFile(path, data, options);
  } catch (err) {
    return err;
  }
}

/**
 * @description md5加密文件内容
 */

async function md5File(path) {
  try {
    const fileContent = await readFile(path);
    return md5(fileContent);
  } catch (err) {
    return err;
  }
}

module.exports = {
  md5File,
  readFile,
  writeFile,
}