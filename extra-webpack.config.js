const webpack = require("webpack");

module.exports = function config(env) {
    return {
        plugins: [
            new webpack.DefinePlugin({__VERSION__: JSON.stringify(require('./package').version)})
        ]
    }
};