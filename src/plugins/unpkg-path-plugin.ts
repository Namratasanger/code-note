import * as esbuild from 'esbuild-wasm';
import axios from "axios";
import localForage from 'localforage';

// using local forage to deal with indexDB 
const fileCache = localForage.createInstance({
  name: 'filecache',

});

export const unpkgPathPlugin = () => {
  return {
    name: 'unpkg-path-plugin',
    setup(build: esbuild.PluginBuild) {
      build.onResolve({ filter: /.*/ }, async (args: any) => {
        console.log('onResolve', args);
        if(args.path === 'index.js'){
          return { path: args.path, namespace: 'a'}
        }
        if(args.path.includes("./") || args.path.includes("../") ){
          return { path: new URL(args.path, "https://unpkg.com" + args.resolveDir + "/").href, namespace: 'a' };  
        }

        return {
          namespace : 'a',
          path: `https://unpkg.com/${args.path}`
        }
      });

      build.onLoad({ filter: /.*/ }, async (args: any) => {
        console.log('onLoad', args);

        if (args.path === 'index.js') {
          return {
            loader: 'jsx',
            contents: `
              const message = require('react');
              console.log(message);
            `,
          };
        } 

        // reducing network calls to the library code for better performance
        // Check whether the file is already fetched and is in the cache
        const cachedResult = await fileCache.getItem<esbuild.OnLoadResult>(args.path);

        // if in cache then return 
        if(cachedResult){
          return cachedResult;
        }

        // file not found use axios to fetch the file
        const { data, request } = await axios.get(args.path);

        const result : esbuild.OnLoadResult = {
          loader: "jsx",
          contents: data,
          resolveDir: new URL("./", request.responseURL).pathname
        }
        // store the reponse in the cache 
        await fileCache.setItem(args.path, result);
        return result;
      });
    },
  };
};