const fs = require('fs');
const path = require('path');
const { Events } = require('discord.js');

const WATCH_PARTIES_FILE = path.join(__dirname, '..', 'data', 'watchParties.json');

function readWatchPartiesData() {
  if (!fs.existsSync(WATCH_PARTIES_FILE)) return { watchParties: {} };
  return JSON.parse(fs.readFileSync(WATCH_PARTIES_FILE, 'utf8'));
}

function writeWatchPartiesData(watchPartiesData) {
  const dir = path.dirname(WATCH_PARTIES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(WATCH_PARTIES_FILE, JSON.stringify(watchPartiesData, null, 2), 'utf8');
}

function hasAnotherActiveWatchPartyForUser(watchPartiesData, guildId, userId, excludedMessageId, now = Date.now()) {
  return Object.entries(watchPartiesData.watchParties).some(([messageId, watchParty]) => {
    if (messageId === excludedMessageId) return false;

    return (
      watchParty.guildId === guildId &&
      watchParty.users.includes(userId) &&
      new Date(watchParty.expiresAt).getTime() > now
    );
  });
}

async function removeSpectatorRoleIfUnused(client, watchPartiesData, watchParty, messageId, now) {
  const guild = await client.guilds.fetch(watchParty.guildId).catch(() => null);
  if (!guild) return;

  const role = guild.roles.cache.get(watchParty.roleId) || await guild.roles.fetch(watchParty.roleId).catch(() => null);
  if (!role) return;

  for (const userId of watchParty.users) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) continue;

    const stillHasAnotherActiveWatchParty = hasAnotherActiveWatchPartyForUser(
      watchPartiesData,
      watchParty.guildId,
      userId,
      messageId,
      now
    );

    if (!stillHasAnotherActiveWatchParty && member.roles.cache.has(role.id)) {
      await member.roles.remove(role).catch(console.error);
    }
  }
}

async function deleteWatchMessage(client, watchParty) {
  const channel = await client.channels.fetch(watchParty.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const message = await channel.messages.fetch(watchParty.messageId).catch(() => null);
  if (!message) return;

  await message.delete().catch(console.error);
}

async function cleanupWatchParties(client) {
  const watchPartiesData = readWatchPartiesData();
  const now = Date.now();
  let changed = false;

  for (const [messageId, watchParty] of Object.entries(watchPartiesData.watchParties)) {
    const roleExpired = new Date(watchParty.expiresAt).getTime() <= now;
    const messageExpired = new Date(
      watchParty.deleteMessageAt || watchParty.expiresAt
    ).getTime() <= now;

    if (roleExpired && !watchParty.roleCleanedUp) {
      await removeSpectatorRoleIfUnused(client, watchPartiesData, watchParty, messageId, now);
      watchParty.roleCleanedUp = true;
      changed = true;
    }

    if (messageExpired && !watchParty.messageDeleted) {
      await deleteWatchMessage(client, watchParty);
      watchParty.messageDeleted = true;
      changed = true;
    }

    if (watchParty.roleCleanedUp && watchParty.messageDeleted) {
      delete watchPartiesData.watchParties[messageId];
      changed = true;
    }
  }

  if (changed) {
    writeWatchPartiesData(watchPartiesData);
  }
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    await cleanupWatchParties(client);

    setInterval(() => {
      cleanupWatchParties(client).catch(console.error);
    }, 10 * 1000); // test
  },
};