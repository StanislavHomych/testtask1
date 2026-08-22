import { allocateUniqueFolderName } from './unique-name';

describe('allocateUniqueFolderName', () => {
  it('returns the desired name when no sibling clash exists', async () => {
    const db = {
      folder: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const result = await allocateUniqueFolderName(
      db as never,
      'room',
      'parent',
      'Contracts',
    );

    expect(result).toEqual({ name: 'Contracts', nameKey: 'contracts' });
  });

  it('appends a stable suffix when the name is taken', async () => {
    const db = {
      folder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'existing' })
          .mockResolvedValueOnce(null),
      },
    };

    const result = await allocateUniqueFolderName(
      db as never,
      'room',
      'parent',
      'Contracts',
    );

    expect(result).toEqual({ name: 'Contracts (1)', nameKey: 'contracts (1)' });
  });
});
