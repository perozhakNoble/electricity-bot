import { DateTime, WeekdayNumbers } from 'luxon';
import TelegramApi from 'node-telegram-bot-api';
import { configs } from '../configs.js';
import {
  getAllGroups,
  getDayLabelFromWeekday,
  getGroupById,
  getGroupIdByChatId,
  getSchedule,
  MESSAGES_ENUM,
  parseSchedule,
  saveUser,
  setUserPhone,
  updateUserGroup,
} from './services.js';

const token = configs.TELEGRAM_TOKEN;

export const Bot = new TelegramApi(token, { polling: true });

export const startBotV2 = async () => {
  const getScheduleForChat = async (chatId: number, weekday?: WeekdayNumbers | 'all') => {
    const groupId = await getGroupIdByChatId(chatId);

    if (!groupId) {
      return Bot.sendMessage(chatId, 'Спершу обери групу!');
    }

    const days = [];

    if (weekday === 'all') {
      days.push(1, 2, 3, 4, 5, 6, 7);
    } else {
      days.push(weekday);
    }

    const messagesPromises = days.map(async (day) => {
      const schedule = await getSchedule(groupId, day as WeekdayNumbers);

      const parsedSchedule = parseSchedule(schedule);

      if (!parsedSchedule) return Bot.sendMessage(chatId, 'От халепа, щось пішло не так...');

      const parsedScheduleWithDay = getDayLabelFromWeekday(day || DateTime.now().weekday) + '\n' + parsedSchedule;

      return parsedScheduleWithDay;
    });

    const messages = await Promise.all(messagesPromises);

    const group = await getGroupById(groupId);

    return [group?.label, messages.join('\n-----------------\n')].filter(Boolean).join('\n');
  };

  const sendMenu = async (chatId: number) => {
    return Bot.sendMessage(chatId, 'Вибирай що тобі потрібно', {
      reply_markup: {
        keyboard: [
          [{ text: MESSAGES_ENUM.GET_ALL_DAYS_SCHEDULE }],
          [{ text: MESSAGES_ENUM.GET_SPECIAL_DAY_SCHEDULE }],
          [{ text: MESSAGES_ENUM.GET_TODAYS_SCHEDULE }],
          [{ text: MESSAGES_ENUM.SET_ANOTHER_GROUP }],
        ],
      },
    });
  };

  // start
  Bot.onText(/\/start/, async (msg) => {
    const { chat, from } = msg;
    const { id: chatId } = chat;

    const { message, user } = await saveUser(chatId, from);

    await Bot.sendMessage(
      937974763,
      'Шапек педор from ' +
        (from?.first_name || '' + ' ' + from?.last_name || '' + ' ' + from?.username || '').trim() || 'Anonim',
    );

    await Bot.sendMessage(chatId, message);

    const phoneExists = !!user.phone;

    if (!phoneExists) {
      return await Bot.sendMessage(chat.id, 'Для розширених функцій, мені потрібен твій номер', {
        reply_markup: {
          keyboard: [
            [
              {
                text: 'Поділитись номером',
                request_contact: true,
              },
              {
                text: MESSAGES_ENUM.WITHOUT_PHONE,
              },
            ],
          ],
        },
      });
    }

    await sendMenu(chatId);

    return;
  });

  // Handle callback queries
  Bot.on('callback_query', async function onCallbackQuery(callbackQuery) {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;

    if (!msg) {
      Bot.sendMessage(callbackQuery.from.id, 'От халепа, щось пішло не так..');
      return;
    }

    const opts = {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
    };

    if (action?.includes('day-')) {
      const weekday = +action[4] as WeekdayNumbers;

      const message = await getScheduleForChat(msg.chat.id, weekday);

      if (typeof message === 'string') {
        return Bot.editMessageText(message, opts);
      }
    }

    const groups = await getAllGroups();

    const group = groups.find((group) => group.id === action);

    if (group) {
      await updateUserGroup(msg.chat.id, group.id);
      Bot.editMessageText('Дякую! Обрано - ' + group.label, opts);
    }
  });

  // menu
  Bot.onText(/\/menu/, (msg) => {
    sendMenu(msg.chat.id);
  });

  // any msg
  Bot.on('message', async (msg) => {
    const { text, chat } = msg;
    // btn menu click
    if (Object.values(MESSAGES_ENUM).includes(text as MESSAGES_ENUM)) {
      switch (text) {
        case MESSAGES_ENUM.WITHOUT_PHONE: {
          return sendMenu(msg.chat.id);
        }

        case MESSAGES_ENUM.GET_ALL_DAYS_SCHEDULE: {
          const message = await getScheduleForChat(chat.id, 'all');

          if (typeof message === 'string') {
            return Bot.sendMessage(chat.id, message);
          }

          return;
        }

        case MESSAGES_ENUM.GET_TODAYS_SCHEDULE: {
          const message = await getScheduleForChat(chat.id);

          if (typeof message === 'string') {
            return Bot.sendMessage(chat.id, message);
          }

          return;
        }

        case MESSAGES_ENUM.GET_SPECIAL_DAY_SCHEDULE: {
          return Bot.sendMessage(msg.chat.id, 'Обери день', {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Понеділок',
                    callback_data: 'day-1',
                    pay: true,
                  },
                  {
                    text: 'Вівторок',
                    callback_data: 'day-2',
                  },
                  {
                    text: 'Середа',
                    callback_data: 'day-3',
                  },

                  {
                    text: 'Четвер',
                    callback_data: 'day-4',
                  },
                ],
                [
                  {
                    text: 'Пʼятниця',
                    callback_data: 'day-5',
                  },
                  {
                    text: 'Субота',
                    callback_data: 'day-6',
                  },
                  {
                    text: 'Неділя',
                    callback_data: 'day-7',
                  },
                ],
              ],
            },
          });
        }

        case MESSAGES_ENUM.SET_ANOTHER_GROUP: {
          const groups = await getAllGroups();

          const opts = {
            reply_markup: {
              inline_keyboard: [
                groups.map((group) => ({
                  text: group.label,
                  callback_data: group.id,
                })),
              ],
            },
          };
          return Bot.sendMessage(msg.chat.id, 'Обирай групу: ', opts);
        }
      }
    }
    // special for Rostyslav
    if (text?.toLocaleLowerCase().includes('хуй')) {
      return Bot.sendMessage(msg.chat.id, 'Сам ти хуй ', {
        reply_to_message_id: msg.message_id,
      });
    }

    if (msg.contact) {
      await setUserPhone(msg.chat.id, msg.contact.phone_number);
      await Bot.sendMessage(msg.chat.id, 'Дякую! Тим часом можеш ознайомитись з меню');
      return sendMenu(msg.chat.id);
    }
  });
};
