import { EscapeHandler, FilterXSS, IFilterXSSOptions, getDefaultWhiteList } from 'xss';

// TODO: Do not allow iframe anymore
const allowIframe: EscapeHandler = (html: string): string => {
  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;iframe(.*)iframe&gt;/g, '<iframe$1iframe>')
    .replace(/(<iframe.*?)&lt;(.*?iframe>)/g, '$1<$2')
    .replace(/(<iframe.*?)&gt;(.*?iframe>)/g, '$1>$2');
};

const whiteList = getDefaultWhiteList();
// every white listed tag are allowing css attribute
Object.keys(whiteList).forEach((tag) => (whiteList as { [key: string]: string[] })[tag].push('style'));

const allowedCssAttributeOptions: IFilterXSSOptions = {
  whiteList,
  css: false,
};

const allowedIframeFilterXSSOptions: IFilterXSSOptions = {
  escapeHtml: allowIframe,
};

const allOptions: IFilterXSSOptions = {
  ...allowedCssAttributeOptions,
  ...allowedIframeFilterXSSOptions,
};

const baseIframeFilter = new FilterXSS(allowedCssAttributeOptions);
const allowedIframeFilter = new FilterXSS(allOptions);

export function sanitizeObject(object: any, isIframeAllowed = false): any {
  const xssFilterToUse = isIframeAllowed ? allowedIframeFilter : baseIframeFilter;
  if (typeof object === 'string') {
    return xssFilterToUse.process(object);
  } else if (typeof object === 'object') {
    Object.keys(object).forEach((key) => {
      if (object[key] !== null) {
        object[key] = sanitizeObject(object[key], isIframeAllowed);
      }
    });
  } else if (Array.isArray(object)) {
    object = object.map((item) => sanitizeObject(item, isIframeAllowed));
  }
  return object;
}
