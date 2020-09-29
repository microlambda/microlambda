/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { load, Schema, Type } from 'js-yaml';
import { readFileSync } from 'fs-extra';

class Mapping {
  map: any;
  constructor(map: any) {
    this.map = map;
  }
}

class Sequence {
  values: any[];
  constructor(...args: any[]) {
    this.values = args;
  }
}

class Scalar {
  value: any;
  constructor(value: any) {
    this.value = value;
  }
}

class Base64 extends Scalar {}
class GetAtt extends Scalar {}
class GetAZ extends Scalar {}
class ImportValue extends Scalar {}
class Ref extends Scalar {}
class Sub extends Scalar {}

class Cidr extends Sequence {}
class FindInMap extends Sequence {}
class And extends Sequence {}
class If extends Sequence {}
class Not extends Sequence {}
class Or extends Sequence {}
class Equals extends Sequence {}
class Join extends Sequence {}
class Select extends Sequence {}
class Split extends Sequence {}

class Transform extends Mapping {}

const customTags: Array<{
  name: string;
  kind: 'scalar' | 'sequence' | 'mapping';
  instanceOf: any;
}> = [
  { name: '!Base64', instanceOf: Base64, kind: 'scalar' },
  { name: '!GetAtt', instanceOf: GetAtt, kind: 'scalar' },
  { name: '!GetAZs', instanceOf: GetAZ, kind: 'scalar' },
  { name: '!ImportValue', instanceOf: ImportValue, kind: 'scalar' },
  { name: '!Ref', instanceOf: Ref, kind: 'scalar' },
  { name: '!Sub', instanceOf: Sub, kind: 'scalar' },
  { name: '!Cidr', instanceOf: Cidr, kind: 'sequence' },
  { name: '!FindInMap', instanceOf: FindInMap, kind: 'sequence' },
  { name: '!And', instanceOf: And, kind: 'sequence' },
  { name: '!If', instanceOf: If, kind: 'sequence' },
  { name: '!Not', instanceOf: Not, kind: 'sequence' },
  { name: '!Or', instanceOf: Or, kind: 'sequence' },
  { name: '!Equals', instanceOf: Equals, kind: 'sequence' },
  { name: '!Join', instanceOf: Join, kind: 'sequence' },
  { name: '!Select', instanceOf: Select, kind: 'sequence' },
  { name: '!Split', instanceOf: Split, kind: 'sequence' },
  { name: '!Transform', instanceOf: Transform, kind: 'mapping' },
];

export const CUSTOM_SCHEMA = Schema.create(
  customTags.map(
    (tag) =>
      new Type(tag.name, {
        kind: tag.kind,
        construct: (data) => {
          return new tag.instanceOf(data);
        },
        instanceOf: tag.instanceOf,
        represent: (object: any) => {
          switch (tag.kind) {
            case 'mapping':
              return { ...object.map };
            case 'scalar':
              return object.value;
            case 'sequence':
              return [...object.values];
          }
        },
      }),
  ),
);

export const parseServerlessYaml = (path: string) => {
  return load(readFileSync(path).toString(), {
    schema: CUSTOM_SCHEMA,
  });
};
