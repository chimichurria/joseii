import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(97);
Config.setOverwriteOutput(true);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setConcurrency(6);
Config.overrideFfmpegCommand(({type, args}) => {
  if (type !== 'stitcher') return args;
  const copia = [...args];
  copia.splice(copia.length - 1, 0, '-g', '15', '-keyint_min', '15', '-movflags', '+faststart');
  return copia;
});
