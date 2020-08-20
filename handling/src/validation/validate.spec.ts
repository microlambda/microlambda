import { string } from 'joi';
import { validate } from './validate';

describe('validation', () => {
  describe('validate', () => {
    it('returns the value formatted by Joi when validation passes', async () => {
      const result = await validate(
        {
          email: '  foo@example.com  ',
        },
        {
          email: string()
            .required()
            .email()
            .trim(),
        },
      );

      expect(result).toStrictEqual({
        email: 'foo@example.com',
      });
    });

    it("throws a ValidationError when validation doesn't pass", async () => {
      expect.assertions(2);
      try {
        await validate(
          {},
          {
            email: string().required(),
          },
        );
      } catch (e) {
        expect(e.name).toBe('ValidationError');
        expect(e.details).toStrictEqual([
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
