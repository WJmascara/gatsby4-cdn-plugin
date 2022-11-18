/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */

// You can delete this file if you're not using it
const onPostBuild = require('./lib/postBuild');
const pluginOptions = {} // 插件传过来的options

exports.onCreateWebpackConfig = ({ actions, stage, getConfig, loaders }, pluginOpt) => {
  Object.assign(pluginOptions, pluginOpt)
  const config = getConfig();
  if (stage === "build-javascript") {
    config.output.filename = "[name].js";
    config.output.chunkFilename = "[name].js";
    config.devtool = false;
    const MiniCssExtractPluginConf = config.plugins.find(
      (item) => item.constructor.name === "MiniCssExtractPlugin"
    );
    if (MiniCssExtractPluginConf) {
      MiniCssExtractPluginConf.options.filename = "[name].css";
      MiniCssExtractPluginConf.options.chunkFilename = "[name].css";
    }
    actions.replaceWebpackConfig(config);
  }
};

exports.onPostBuild = onPostBuild.bind(null, pluginOptions)
