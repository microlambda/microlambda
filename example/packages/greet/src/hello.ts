import data from './hello.json';

const hello: Array<{language: string, hello: string}> = data;

export const sayHello = (lang = 'Finnish'): string => {
  const translation = hello.find(h => h.language === lang);
  return translation ? translation.hello : 'Hello';
};

export const greet = (name: string, lang?: string) => `${sayHello(lang)} ${name}`;
