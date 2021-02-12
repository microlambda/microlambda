import { string, object } from '@hapi/joi';
import { validate } from './validate';

describe('validation', () => {
  describe('validate', () => {
    it('returns the value formatted by Joi when validation passes', async () => {
      const result = await validate(
        {
          email: '  foo@example.com  ',
        },
        object({
          email: string().required().email().trim(),
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
          object({
            email: string().required(),
          }),
        );
        fail();
      } catch (e) {
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
