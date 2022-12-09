import { ElectricityAvailability, PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

const creatorData = {
  chatId: 392177872,
  firstName: 'The Vtlk',
  lastName: 'Creator',
  username: 'vtlllk',
};

const GROUP_LABELS = {
  FIRST: 'I група',
  SECOND: 'II група',
  THIRD: 'III група',
};

const groups = [
  {
    label: GROUP_LABELS.FIRST,
  },
  {
    label: GROUP_LABELS.SECOND,
  },
  {
    label: GROUP_LABELS.THIRD,
  },
];

const days = [
  { label: 'Понеділок', weekday: 1 },
  { label: 'Вівторок', weekday: 2 },
  { label: 'Середа', weekday: 3 },
  { label: 'Четвер', weekday: 4 },
  { label: 'Пʼятниця', weekday: 5 },
  { label: 'Субота', weekday: 6 },
  { label: 'Неділя', weekday: 7 },
];

const periods = [
  { from: 1, to: 5, order: 1 },
  { from: 5, to: 9, order: 2 },
  { from: 9, to: 13, order: 3 },
  { from: 13, to: 17, order: 4 },
  { from: 17, to: 21, order: 5 },
  { from: 21, to: 1, order: 6 },
];

const STARTS_WITH_CASES = {
  NO: ['NO', 'YES', 'MAYBE', 'NO', 'YES', 'MAYBE'],
  YES: ['YES', 'MAYBE', 'NO', 'YES', 'MAYBE', 'NO'],
  MAYBE: ['MAYBE', 'NO', 'YES', 'MAYBE', 'NO', 'YES'],
};

const DB = [
  [
    // Перша група
    [
      // mon
      ...STARTS_WITH_CASES.NO,
    ],
    [
      // tue
      ...STARTS_WITH_CASES.YES,
    ],
    [
      // wed
      ...STARTS_WITH_CASES.MAYBE,
    ],
    [
      // thu
      ...STARTS_WITH_CASES.NO,
    ],
    [
      // fri
      ...STARTS_WITH_CASES.YES,
    ],
    [
      // sat
      ...STARTS_WITH_CASES.MAYBE,
    ],
    [
      // sun
      ...STARTS_WITH_CASES.NO,
    ],
  ],
  [
    // Друга група
    [
      // mon
      ...STARTS_WITH_CASES.YES,
    ],
    [
      // tue
      ...STARTS_WITH_CASES.MAYBE,
    ],
    [
      // wed
      ...STARTS_WITH_CASES.NO,
    ],
    [
      // thu
      ...STARTS_WITH_CASES.YES,
    ],
    [
      // fri
      ...STARTS_WITH_CASES.MAYBE,
    ],
    [
      // sat
      ...STARTS_WITH_CASES.NO,
    ],
    [
      // sun
      ...STARTS_WITH_CASES.YES,
    ],
  ],
  [
    // Третя група
    [
      // mon
      ...STARTS_WITH_CASES.MAYBE,
    ],
    [
      // tue
      ...STARTS_WITH_CASES.NO,
    ],

    [
      // wed
      ...STARTS_WITH_CASES.YES,
    ],
    [
      // thu
      ...STARTS_WITH_CASES.MAYBE,
    ],
    [
      // fri
      ...STARTS_WITH_CASES.NO,
    ],
    [
      // sat
      ...STARTS_WITH_CASES.YES,
    ],
    [
      // sun
      ...STARTS_WITH_CASES.MAYBE,
    ],
  ],
];

const seed = async () => {
  try {
    console.log('🦩  Seed started!');

    await prisma.groupPeriod.deleteMany();
    await prisma.day.deleteMany();
    await prisma.period.deleteMany();
    await prisma.group.deleteMany();
    await prisma.user.deleteMany();

    console.log();
    console.log('👹  Old entities deleted!');

    // days
    for (const { label, weekday } of days) {
      await prisma.day.create({
        data: {
          label,
          weekday,
        },
      });
    }

    // periods
    for (const period of periods) {
      await prisma.period.create({
        data: {
          from: DateTime.fromObject({
            hour: period.from,
          })
            .plus({ second: 1 })
            .toISOTime(),
          to: DateTime.fromObject({
            hour: period.to,
          }).toISOTime(),
          order: period.order,
        },
      });
    }

    // groups
    for (const group of groups) {
      await prisma.group.create({
        data: {
          label: group.label,
        },
      });
    }

    // me
    await prisma.user.create({
      data: creatorData,
    });

    const groupsFromDB = await prisma.group.findMany();
    const periodsFromDB = await prisma.period.findMany({
      orderBy: {
        order: 'asc',
      },
    });
    const daysFromDB = await prisma.day.findMany({
      orderBy: {
        weekday: 'asc',
      },
    });

    for (const group of groupsFromDB) {
      const isFirstGroup = group.label === GROUP_LABELS.FIRST;
      // const isSecondGroup = group.label === GROUP_LABELS.SECOND;
      const isThirdGroup = group.label === GROUP_LABELS.THIRD;

      const data = isFirstGroup ? DB[0] : isThirdGroup ? DB[2] : DB[1];

      const daysPromise = daysFromDB.map(async (day, dayIdx) => {
        const periodPromises = periodsFromDB.map(async (period, periodIdx) => {
          return await prisma.groupPeriod.create({
            data: {
              period: {
                connect: {
                  id: period.id,
                },
              },
              day: {
                connect: {
                  id: day.id,
                },
              },
              group: {
                connect: {
                  id: group.id,
                },
              },
              availability: (data[dayIdx]?.[periodIdx] as ElectricityAvailability) || 'MAYBE',
            },
          });
        });

        return await Promise.all(periodPromises);
      });

      await Promise.all(daysPromise);
    }
  } catch (err) {
    console.error('Seed error: ', err);
  }
};

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
