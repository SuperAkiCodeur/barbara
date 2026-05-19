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

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    try {
      console.log('Réaction détectée');

      if (user.bot) return;

      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();

      console.log('Emoji :', reaction.emoji.name);
      console.log('Message ID :', reaction.message.id);
      console.log('User ID :', user.id);

      if (reaction.emoji.name !== '🎟️') return;
      if (!reaction.message.guild) return;

      const bookings = readBookings();
      const booking = bookings.movies[reaction.message.id];

      console.log('Booking trouvé :', !!booking);

      if (!booking) return;

      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id).catch(() => null);

      console.log('Member trouvé :', !!member);

      if (!member) return;

      const role = guild.roles.cache.get(booking.roleId);

      console.log('Role trouvé :', !!role, booking.roleId);

      if (!role) return;

      if (!booking.users.includes(user.id)) {
        booking.users.push(user.id);
        writeBookings(bookings);
      }

      await member.roles.add(role);
      console.log(`Rôle ajouté à ${user.tag}`);
    } catch (error) {
      console.error('Erreur messageReactionAdd :', error);
    }
  },
};