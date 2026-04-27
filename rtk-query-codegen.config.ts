import type { ConfigFile } from '@rtk-query/codegen-openapi';

const byTag = (tagName: string) => (_endpoint: string, definition: any) => {
  const tags = definition?.operation?.tags || [];
  return tags.includes(tagName);
};

const config: ConfigFile = {
  schemaFile: 'https://ai-toy-fastapi.onrender.com/openapi.json',
  apiFile: './src/lib/api/baseApi.ts',
  apiImport: 'baseApi',
  hooks: true,
  tag: true,
  outputFiles: {
    // './src/lib/api/generated/healthApi.ts': {
    //   filterEndpoints: byTag('health'),
    //   apiImport: 'baseApi',
    // },
    // './src/lib/api/generated/toyApi.ts': {
    //   filterEndpoints: byTag('toy'),
    //   apiImport: 'baseApi',
    // },
    './src/lib/api/generated/parentsApi.ts': {
      filterEndpoints: byTag('parents'),
      apiImport: 'baseApi',
    },
    // './src/lib/api/generated/childrenApi.ts': {
    //   filterEndpoints: byTag('children'),
    //   apiImport: 'baseApi',
    // },
    // './src/lib/api/generated/curriculumApi.ts': {
    //   filterEndpoints: byTag('curriculum'),
    //   apiImport: 'baseApi',
    // },
    './src/lib/api/generated/authApi.ts': {
      filterEndpoints: byTag('auth'),
      apiImport: 'baseApi',
    },
  },
};

export default config;
