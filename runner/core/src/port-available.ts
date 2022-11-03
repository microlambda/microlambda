import { Socket } from "net";

export const isPortAvailable = async (port: number, host = '127.0.0.1', timeout = 400): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new Socket();
    let status: 'open' | 'closed';
    socket.on('connect', () => {
      status = 'open';
      socket.destroy();
    });
    socket.setTimeout(timeout);
    socket.on('timeout', () => {
      status = 'closed';
      socket.destroy();
    });
    socket.on('error', () => {
      status = 'closed';
    });
    socket.on('close', () => {
      resolve(status === 'open');
    });
    socket.connect(port, host);
  });
};
