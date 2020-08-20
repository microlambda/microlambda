import { errorNotUnique } from './errors';

describe('validation', () => {
  describe('errors', () => {
    describe('errorNotUnique', () => {
      it('renders correctly', () => {
        const result = errorNotUnique('email', 'user.email');
        expect(result).toStrictEqual({
          name: 'ValidationError',
          details: [
            {
              message: `"email" is not unique`,
              path: 'user.email',
              type: 'any.unique',
              context: {
                key: 'user.email',
              },
            },
          ],
        });
      });
    });
  });
});
