import { createServer } from 'net';

/**
 * Find an available port starting from the preferred port
 * @param {number} preferredPort - The preferred port to start from
 * @param {number} maxAttempts - Maximum number of ports to try
 * @returns {Promise<number>} First available port found
 */
export const findAvailablePort = (preferredPort = 5000, maxAttempts = 100) => {
  return new Promise((resolve, reject) => {
    let currentPort = preferredPort;
    let attempts = 0;

    const tryPort = () => {
      if (attempts >= maxAttempts) {
        reject(
          new Error(
            `Could not find an available port between ${preferredPort} and ${preferredPort + maxAttempts - 1}`
          )
        );
        return;
      }

      const server = createServer();
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          currentPort++;
          attempts++;
          server.close();
          setImmediate(tryPort);
        } else {
          reject(err);
        }
      });

      server.once('listening', () => {
        server.close(() => {
          resolve(currentPort);
        });
      });

      server.listen(currentPort, '127.0.0.1');
    };

    tryPort();
  });
};

export default findAvailablePort;
