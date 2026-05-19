const fs = require('fs');
const path = require('path');
const { Events } = require('discord.js');

const BOOKINGS_FILE = path.join(__dirname, '..', 'data', 'movieBookings.json');

function readBookings() {
  if (!fs.existsSync(BOOKINGS_FILE)) return { movies: {} };
  return JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
}

function writeBookings(data) {
  const dir = path.dirname(BOOKINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function cleanupExpiredBookings(client) {
  const bookings = readBookings();
  const now = Date.now();
  let changed = false;

  for (const [messageId, booking] of Object.entries(bookings.movies)) {
    const expired = new Date(booking.expiresAt).getTime() <= now;
    if (!expired) continue;

    const guild = await client.guilds.fetch(booking.guildId).catch(() => null);
    if (!guild) {
      delete bookings.movies[messageId];
      changed = true;
      continue;
    }

    for (const userId of booking.users) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;

      const role = guild.roles.cache.get(booking.roleId);
      if (!role) continue;

      const stillHasAnotherActiveBooking = Object.entries(bookings.movies).some(([otherId, otherBooking]) => {
        if (otherId === messageId) return false;

        return (
          otherBooking.guildId === booking.guildId &&
          otherBooking.users.includes(userId) &&
          new Date(otherBooking.expiresAt).getTime() > now
        );
      });

      if (!stillHasAnotherActiveBooking && member.roles.cache.has(role.id)) {
        await member.roles.remove(role).catch(console.error);
      }
    }

    delete bookings.movies[messageId];
    changed = true;
  }

  if (changed) {
    writeBookings(bookings);
  }
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    await cleanupExpiredBookings(client);

    setInterval(() => {
      cleanupExpiredBookings(client).catch(console.error);
    }, 5 * 60 * 1000);
  },
};