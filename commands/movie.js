const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const BOOKINGS_FILE = path.join(__dirname, '..', 'data', 'movieBookings.json');
const TMDB_API_KEY = process.env.TMDB_API_KEY;
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

function formatRuntime(minutes) {
  if (!minutes || Number.isNaN(minutes)) return 'Inconnue';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${m.toString().padStart(2, '0')}min`;
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

    if (!TMDB_API_KEY) {
      return interaction.reply({
        content: 'TMDB_API_KEY manquant dans les variables d’environnement.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!SPECTATOR_ROLE_ID) {
      return interaction.reply({
        content: 'SPECTATOR_ROLE_ID manquant dans les variables d’environnement.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const viewingDate = parseViewingDate(date, heure);

    if (isNaN(viewingDate.getTime())) {
      return interaction.reply({
        content: 'Date ou heure invalide. Utilise par exemple 19/05/26 et 21:00.',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(film)}&language=fr-FR&include_adult=false`;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (!searchData.results || searchData.results.length === 0) {
        return interaction.reply({
          content: `Aucun film trouvé pour "${film}".`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const bestMatch = searchData.results[0];
      const movieId = bestMatch.id;

      const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=fr-FR`;
      const creditsUrl = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${TMDB_API_KEY}&language=fr-FR`;

      const [detailsResponse, creditsResponse] = await Promise.all([
        fetch(detailsUrl),
        fetch(creditsUrl),
      ]);

      const details = await detailsResponse.json();
      const credits = await creditsResponse.json();

      const director = credits.crew?.find(person => person.job === 'Director');
      const directorName = director?.name || 'Inconnu';

      const title = details.title || bestMatch.title || film;
      const overview = details.overview || 'Synopsis indisponible.';
      const releaseDate = details.release_date
        ? new Date(details.release_date).toLocaleDateString('fr-FR')
        : 'Inconnue';
      const runtime = formatRuntime(details.runtime);
      const genres = details.genres?.length
        ? details.genres.map(g => g.name).join(', ')
        : 'Inconnus';

      const posterUrl = details.poster_path
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
        : null;

      const embed = new EmbedBuilder()
        .setTitle(`🎬 ${title}`)
        .setDescription(overview)
        .addFields(
          { name: 'Réalisateur', value: directorName, inline: true },
          { name: 'Sortie', value: releaseDate, inline: true },
          { name: 'Durée', value: runtime, inline: true },
          { name: 'Genres', value: genres, inline: false },
          { name: 'Visionnage', value: `${date} à ${heure}`, inline: false },
          { name: 'Billetterie', value: 'Réagis avec 🎟️ pour réserver ta place.', inline: false },
        )
        .setColor(0x1f1f1f)
        .setFooter({ text: 'Cinéma du serveur' });

      if (posterUrl) {
        embed.setImage(posterUrl);
      }

      const message = await interaction.channel.send({ embeds: [embed] });
      await message.react('🎟️');

      const bookings = readBookings();
      bookings.movies[message.id] = {
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        messageId: message.id,
        roleId: SPECTATOR_ROLE_ID,
        title,
        movieId,
        viewingAt: viewingDate.toISOString(),
        expiresAt: new Date(viewingDate.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        users: [],
      };
      writeBookings(bookings);

      await interaction.reply({
        content: 'Annonce cinéma publiée avec billetterie.',
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('Erreur /movie avec TMDb :', error);

      return interaction.reply({
        content: 'Une erreur est survenue avec TMDb.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};