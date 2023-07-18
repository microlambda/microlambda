import joi from 'joi';
import { validate } from './validate';
import { HandlingError } from '../handling/api';

describe('validation', () => {
  describe('validate', () => {
    it('returns the value formatted by Joi when validation passes', async () => {
      const result = await validate(
        {
          email: '  foo@example.com  ',
        },
        joi.object({
          email: joi.string().required().email().trim(),
        }),
      );

      expect(result).toEqual({
        email: 'foo@example.com',
      });
    });

    it("throws a ValidationError when validation doesn't pass", async () => {
      try {
        await validate(
          {},
          joi.object({
            email: joi.string().required(),
          }),
        );
        fail();
      } catch (err) {
        const e = err as HandlingError;
        expect(e.name).toBe('ValidationError');
        expect(e.details).toEqual([
          {
            context: { key: 'email', label: 'email' },
            message: '"email" is required',
            path: ['email'],
            type: 'any.required',
          },
        ]);
      }
    });
  });
});
