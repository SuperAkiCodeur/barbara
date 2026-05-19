const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const BOOKINGS_FILE = path.join(__dirname, '..', 'data', 'movieBookings.json');
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const SPECTATOR_ROLE_ID = process.env.SPECTATOR_ROLE_ID;

function readBookings() {
  if (!fs.existsSync(BOOKINGS_FILE)) return { movies: {} };
  return JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
}

function writeBookings(data) {
  const dir = path.dirname(BOOKINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function parseViewingDate(dateStr, timeStr) {
  const [day, month, year] = dateStr.split('/').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  const fullYear = year < 100 ? 2000 + year : year;
  return new Date(fullYear, month - 1, day, hours, minutes, 0, 0);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('movie')
    .setDescription('Publie une annonce de séance cinéma')
    .addStringOption(option =>
      option
        .setName('film')
        .setDescription('Titre du film')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('Date du visionnage (ex: 19/05/26)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('heure')
        .setDescription('Heure du visionnage (ex: 21:00)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const film = interaction.options.getString('film');
    const date = interaction.options.getString('date');
    const heure = interaction.options.getString('heure');

    if (!OMDB_API_KEY) {
      return interaction.reply({
        content: 'OMDB_API_KEY manquant dans les variables d’environnement.',
        ephemeral: true,
      });
    }

    if (!SPECTATOR_ROLE_ID) {
      return interaction.reply({
        content: 'SPECTATOR_ROLE_ID manquant dans les variables d’environnement.',
        ephemeral: true,
      });
    }

    const viewingDate = parseViewingDate(date, heure);

    if (isNaN(viewingDate.getTime())) {
      return interaction.reply({
        content: 'Date ou heure invalide. Utilise par exemple 19/05/26 et 21:00.',
        ephemeral: true,
      });
    }

    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(film)}&plot=full`;
    const response = await fetch(url);
    const movie = await response.json();

    if (!movie || movie.Response === 'False') {
      return interaction.reply({
        content: `Impossible de trouver le film "${film}".`,
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎬 ${movie.Title}`)
      .setDescription(movie.Plot || 'Synopsis indisponible.')
      .addFields(
        { name: 'Réalisateur', value: movie.Director || 'Inconnu', inline: true },
        { name: 'Sortie', value: movie.Released || 'Inconnue', inline: true },
        { name: 'Durée', value: movie.Runtime || 'Inconnue', inline: true },
        { name: 'Genres', value: movie.Genre || 'Inconnus', inline: false },
        { name: 'Visionnage', value: `${date} à ${heure}`, inline: false },
        { name: 'Billetterie', value: 'Réagis avec 🎟️ pour réserver ta place.', inline: false },
      )
      .setColor(0x1f1f1f)
      .setFooter({ text: 'Cinéma du serveur' });

    if (movie.Poster && movie.Poster !== 'N/A') {
      embed.setImage(movie.Poster);
    }

    const message = await interaction.channel.send({ embeds: [embed] });
    await message.react('🎟️');

    const bookings = readBookings();
    bookings.movies[message.id] = {
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      messageId: message.id,
      roleId: SPECTATOR_ROLE_ID,
      title: movie.Title,
      viewingAt: viewingDate.toISOString(),
      expiresAt: new Date(viewingDate.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      users: [],
    };
    writeBookings(bookings);

    await interaction.reply({
      content: 'Annonce cinéma publiée avec billetterie.',
      ephemeral: true,
    });
  },
};