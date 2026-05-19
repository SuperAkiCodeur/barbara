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

function hasActiveBookingForUser(bookings, guildId, userId, now = Date.now()) {
  return Object.values(bookings.movies).some(booking => {
    return (
      booking.guildId === guildId &&
      booking.users.includes(userId) &&
      new Date(booking.expiresAt).getTime() > now
    );
  });
}

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    if (user.bot) return;

    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.emoji.name !== '🎟️') return;
    if (!reaction.message.guild) return;

    const bookings = readBookings();
    const booking = bookings.movies[reaction.message.id];
    if (!booking) return;

    booking.users = booking.users.filter(id => id !== user.id);
    writeBookings(bookings);

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(booking.roleId);
    if (!role) return;

    const stillHasActiveBooking = hasActiveBookingForUser(bookings, guild.id, user.id);

    if (!stillHasActiveBooking && member.roles.cache.has(role.id)) {
      await member.roles.remove(role).catch(console.error);
    }
  },
};