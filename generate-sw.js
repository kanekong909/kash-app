const { generateSW } = require('workbox-build');

generateSW({
  globDirectory: 'public',
  globPatterns: [
    '**/*.{html,css,js,json,svg,png,jpg,jpeg,gif,ico,ttf,woff,woff2}'
  ],
  swDest: 'public/sw.js',
  clientsClaim: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
      }
    }
  ]
}).then(() => {
  console.log('✅ Service Worker generado correctamente en public/sw.js');
}).catch(err => {
  console.error('❌ Error al generar SW:', err);
});