const ImageMinimizerPlugin = require("image-minimizer-webpack-plugin");
module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpg|jpeg|svg)$/,
        type: "asset/resource",
        use: [
          {
            loader: "image-webpack-loader",
            options: {
              mozjpeg: { quality: 75 },
              pngquant: { quality: [0.65, 0.9], speed: 4 },
              svgo: { plugins: [{ removeViewBox: false }] },
              gifsicle: { optimizationLevel: 3 },
              webp: { quality: 75 },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new ImageMinimizerPlugin({
      minimizerOptions: {
        plugins: ["gifsicle", "mozjpeg", "pngquant", "svgo"],
      },
    }),
  ],
};