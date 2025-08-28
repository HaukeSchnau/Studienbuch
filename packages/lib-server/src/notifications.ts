import { Data, Effect } from "effect";
import type { ExpoPushMessage } from "expo-server-sdk";
import { Expo } from "expo-server-sdk";

// Create a new Expo SDK client
// optionally providing an access token if you have enabled push security
const expo = new Expo();

class PushNotificationError extends Data.TaggedError("PushNotificationError")<{ cause: unknown }> {}

export const sendNotifications = Effect.fn(function* (pushTokens: string[], title: string, message: string) {
  // Create the messages that you want to send to clients
  const messages: ExpoPushMessage[] = [];
  for (const pushToken of pushTokens) {
    // Each push token looks like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]

    // Check that all your push tokens appear to be valid Expo push tokens
    if (!Expo.isExpoPushToken(pushToken)) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- ExpoPushToken is a string, so it evaluates to never here. Not great typing on Expo's side.
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      continue;
    }

    // Construct a message (see https://docs.expo.io/push-notifications/sending-notifications/)
    messages.push({
      to: pushToken,
      sound: "default",
      body: message,
      title,
    });
  }

  // The Expo push notification service accepts batches of notifications so
  // that you don't need to send 1000 requests to send 1000 notifications. We
  // recommend you batch your notifications to reduce the number of requests
  // and to compress them (notifications with similar content will get
  // compressed).
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  // Send the chunks to the Expo push notification service. There are
  // different strategies you could use. A simple one is to send one chunk at a
  // time, which nicely spreads the load out over time:
  for (const chunk of chunks) {
    try {
      const ticketChunk = yield* Effect.tryPromise({
        try: () => expo.sendPushNotificationsAsync(chunk),
        catch: (error) => new PushNotificationError({ cause: error }),
      });
      console.log(ticketChunk);
      tickets.push(...ticketChunk);
      // NOTE: If a ticket contains an error code in ticket.details.error, you
      // must handle it appropriately. The error codes are listed in the Expo
      // documentation:
      // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
    } catch (error) {
      console.error(error);
    }
  }

  return tickets;
});
