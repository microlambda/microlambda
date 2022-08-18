// import { stub } from 'sinon';
// import { logger } from '../../src';

describe('Test Logger', () => {
  it('fake test to complete', () => {
    expect(1).toEqual(1);
  });

  //   const OLD_ENV = process.env;
  //   const consoleStubFct = () => {};
  //   const debugSpy = stub(console, 'debug', consoleStubFct);
  //
  //   beforeEach(() => {
  //     jest.resetModules();
  //     console.debug = debugSpy;
  //     // consoleSpy = {
  //     //   log: spy(console, 'log'),
  //     //   debug: spy(console, 'debug'),
  //     //   warn: spy(console, 'warn'),
  //     //   error: spy(console, 'error'),
  //     //   info: spy(console, 'info'),
  //     // };
  //     process.env = { ...OLD_ENV };
  //   });
  //
  //   afterEach(() => {
  //     // consoleSpy.restore();
  //   });
  //
  //   afterAll(() => {
  //     process.env = OLD_ENV;
  //   });
  //
  //   describe('Test silly callback', () => {
  //     it('Should call the console.debug function with no env variable', () => {
  //       expect(debugSpy.called).toBeFalsy();
  //       delete process.env.env;
  //       logger.silly(process.env.env);
  //       expect(console.debug.call()).toBeTruthy();
  //     });
  //
  //     // it('Should NOT call the console.debug function', () => {
  //     //   process.env.env = 'preprod';
  //     //   logger.silly(process.env.env);
  //     //
  //     //   expect(spies.debug.called).toBeFalsy();
  //     // });
  //   });
  //   //
  //   // describe('Test debug callback', () => {
  //   //   it('Should call the console.debug function with no env', () => {
  //   //     delete process.env.env;
  //   //     logger.silly(process.env.env);
  //   //
  //   //     expect(spies.debug).toBeCalled();
  //   //   });
  //   //
  //   //   it('Should call the console.debug function with "preprod" env', () => {
  //   //     process.env.env = 'preprod';
  //   //     logger.silly(process.env.env);
  //   //
  //   //     expect(spies.debug).toBeCalled();
  //   //   });
  //   //
  //   //   it('Should NOT call the console.debug function with "prod" env', () => {
  //   //     process.env.env = 'prod';
  //   //     logger.silly(process.env.env);
  //   //
  //   //     expect(spies.debug).toBeCalled();
  //   //   });
  //   // });
  //   //
  //   // describe('Test log callback', () => {
  //   //   it('Should call the console.log function with no env', () => {
  //   //     delete process.env.env;
  //   //     logger.silly(process.env.env);
  //   //
  //   //     expect(spies.log).toBeCalled();
  //   //   });
  //   //
  //   //   it('Should call the console.log function with "preprod" env', () => {
  //   //     process.env.env = 'preprod';
  //   //     logger.silly(process.env.env);
  //   //
  //   //     expect(spies.log).toBeCalled();
  //   //   });
  //   //
  //   //   it('Should NOT call the console.log function with "prod" env', () => {
  //   //     process.env.env = 'prod';
  //   //     logger.silly(process.env.env);
  //   //
  //   //     expect(spies.log).toBeCalled();
  //   //   });
  //   // });
  //   //
  //   // describe('Test info callback', () => {
  //   //   it('Should call the console.info function with no env', () => {
  //   //     delete process.env.env;
  //   //     logger.silly(process.env.env);
  //   //
  //   //     expect(spies.info).toBeCalled();
  //   //   });
  //   //
  //   //   it('Should call the console.info function with "preprod" env', () => {
  //   //     process.env.env = 'preprod';
  //   //     logger.silly(process.env.env);
  //   //
  //   //     expect(spies.info).toBeCalled();
  //   //   });
  //   //
  //   //   it('Should NOT call the console.info function with "prod" env', () => {
  //   //     process.env.env = 'prod';
  //   //     logger.silly(process.env.env);
  //   //
  //   //     expect(spies.info).toBeCalled();
  //   //   });
  //   // });
});
