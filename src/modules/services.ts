import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import TelegramBot from 'node-telegram-bot-api';

const prisma = new PrismaClient();

export enum MESSAGES_ENUM {
  GET_TODAYS_SCHEDULE = 'Отримати графік на сьогодні',
  SET_ANOTHER_GROUP = 'Вибрати групу',
  GET_ALL_DAYS_SCHEDULE = 'Отримати повний графік',
  GET_SPECIAL_DAY_SCHEDULE = 'Отримати графік по заданому дню',
  WITHOUT_PHONE = 'Продовжити без номера',
}

export const ICONS = {
  YES: '🟢',
  NO: '🔴',
  MAYBE: '⚪️',
  '?': '❔',
};

const getAvailabilityIcon = (avlb: string) => {
  switch (avlb) {
    case 'YES': {
      return ICONS.YES;
    }
    case 'NO': {
      return ICONS.NO;
    }

    case 'MAYBE': {
      return ICONS.MAYBE;
    }
    default: {
      return ICONS['?'];
    }
  }
};

export const saveUser = async (chatId: number, from?: TelegramBot.User) => {
  const user = await prisma.user.findUnique({ where: { chatId } });
  if (!user) {
    const newUser = await prisma.user.create({
      data: {
        chatId,
        firstName: from?.first_name,
        lastName: from?.last_name,
        username: from?.username,
      },
    });
    return { message: `Вітаю тут, ${newUser.firstName || 'Друже'}!`, user: newUser };
  } else {
    return { message: `З поверненням, ${user.firstName || 'Друже'}!`, user };
  }
};

export const getGroupIdByChatId = async (chatId: number): Promise<string | undefined | null> => {
  const group = await prisma.user.findUnique({
    where: {
      chatId,
    },
    select: {
      id: true,
      groupId: true,
    },
  });

  return group?.groupId;
};

export const getDayLabelFromWeekday = (weekday: number): string | undefined => {
  switch (weekday) {
    case 1: {
      return 'Понеділок';
    }
    case 2: {
      return 'Вівторок';
    }
    case 3: {
      return 'Середа';
    }
    case 4: {
      return 'Четвер';
    }
    case 5: {
      return 'Пʼятниця';
    }
    case 6: {
      return 'Субота';
    }
    case 7: {
      return 'Неділя';
    }
  }
};

type Schedule = {
  label: string;
  groupPeriod: {
    availability: string;
    day: {
      label: string;
      weekday: number;
    };
    period: {
      from: string;
      to: string;
      order: number;
    };
  }[];
};

export const parseSchedule = (schedule: Schedule | null) => {
  return schedule?.groupPeriod
    .map(({ availability, period }) => ({
      availability,
      order: period.order,
      from: DateTime.fromISO(period.from).toFormat('HH') + ':00',
      to: DateTime.fromISO(period.to).toFormat('HH') + ':00',
    }))
    .sort((a, b) => a.order - b.order)
    .map((period) => {
      const availability = getAvailabilityIcon(period.availability);
      const hours = period.from + ' - ' + period.to;
      return availability + ' ' + hours;
    })
    .join('\n');
};

export const getSchedule = async (groupId: string, weekday = DateTime.now().weekday): Promise<Schedule | null> => {
  const day = await prisma.day.findUniqueOrThrow({
    where: {
      weekday,
    },
  });

  return await prisma.group.findUnique({
    where: {
      id: groupId,
    },
    select: {
      label: true,
      groupPeriod: {
        where: {
          dayId: day.id,
        },
        select: {
          availability: true,
          day: {
            select: {
              label: true,
              weekday: true,
            },
          },
          period: {
            select: {
              from: true,
              to: true,
              order: true,
            },
          },
        },
      },
    },
  });
};

export const updateUserGroup = async (chatId: number, groupId: string) => {
  return await prisma.user.update({
    where: { chatId },
    data: {
      group: {
        connect: {
          id: groupId,
        },
      },
    },
  });
};

export const getAllGroups = async () => {
  return await prisma.group.findMany();
};

export const getGroupById = async (groupId: string) => {
  return await prisma.group.findUnique({ where: { id: groupId } });
};

export const setUserPhone = async (chatId: number, phone: string) => {
  return await prisma.user.update({
    where: {
      chatId,
    },
    data: {
      phone,
    },
  });
};
