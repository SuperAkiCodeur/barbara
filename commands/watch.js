const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const WATCH_PARTIES_FILE = path.join(__dirname, '..', 'data', 'watchParties.json');
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const SPECTATOR_ROLE_ID = process.env.SPECTATOR_ROLE_ID;

function readWatchPartiesData() {
  if (!fs.existsSync(WATCH_PARTIES_FILE)) return { watchParties: {} };
  return JSON.parse(fs.readFileSync(WATCH_PARTIES_FILE, 'utf8'));
}

function writeWatchPartiesData(watchPartiesData) {
  const dir = path.dirname(WATCH_PARTIES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(WATCH_PARTIES_FILE, JSON.stringify(watchPartiesData, null, 2), 'utf8');
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

function formatDate(dateString) {
  if (!dateString) return 'Inconnue';
  return new Date(dateString).toLocaleDateString('fr-FR');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('watch')
    .setDescription('Publie une annonce de séance pour un film ou une série')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type de contenu')
        .setRequired(true)
        .addChoices(
          { name: 'Film', value: 'movie' },
          { name: 'Série', value: 'tv' }
        )
    )
    .addStringOption(option =>
      option
        .setName('titre')
        .setDescription('Titre du film ou de la série')
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
    const type = interaction.options.getString('type');
    const titre = interaction.options.getString('titre');
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
      const searchUrl = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(titre)}&language=fr-FR&include_adult=false`;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (!searchData.results || searchData.results.length === 0) {
        return interaction.reply({
          content: `Aucun résultat trouvé pour "${titre}".`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const bestMatch = searchData.results[0];
      const mediaId = bestMatch.id;

      const detailsUrl = `https://api.themoviedb.org/3/${type}/${mediaId}?api_key=${TMDB_API_KEY}&language=fr-FR`;
      const creditsUrl = `https://api.themoviedb.org/3/${type}/${mediaId}/credits?api_key=${TMDB_API_KEY}&language=fr-FR`;

      const [detailsResponse, creditsResponse] = await Promise.all([
        fetch(detailsUrl),
        fetch(creditsUrl),
      ]);

      const details = await detailsResponse.json();
      const credits = await creditsResponse.json();

      const isMovie = type === 'movie';

      const title = isMovie
        ? (details.title || bestMatch.title || titre)
        : (details.name || bestMatch.name || titre);

      const overview = details.overview || 'Synopsis indisponible.';
      const releaseDate = isMovie
        ? formatDate(details.release_date)
        : formatDate(details.first_air_date);

      const runtime = isMovie
        ? formatRuntime(details.runtime)
        : formatRuntime(details.episode_run_time?.[0]);

      const genres = details.genres?.length
        ? details.genres.map(g => g.name).join(', ')
        : 'Inconnus';

      const posterUrl = details.poster_path
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
        : null;

      let authorLabel = 'Réalisateur';
      let authorValue = 'Inconnu';

      if (isMovie) {
        const director = credits.crew?.find(person => person.job === 'Director');
        authorValue = director?.name || 'Inconnu';
      } else {
        authorLabel = 'Créateur';
        if (details.created_by?.length) {
          authorValue = details.created_by.map(person => person.name).join(', ');
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(overview)
        .addFields(
          { name: 'Type', value: isMovie ? 'Film' : 'Série', inline: true },
          { name: authorLabel, value: authorValue, inline: true },
          { name: isMovie ? 'Sortie' : 'Première diffusion', value: releaseDate, inline: true },
          { name: isMovie ? 'Durée' : 'Durée épisode', value: runtime, inline: true },
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

      const watchPartiesData = readWatchPartiesData();
      watchPartiesData.watchParties[message.id] = {
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        messageId: message.id,
        roleId: SPECTATOR_ROLE_ID,
        title,
        mediaType: type,
        mediaId,
        viewingAt: viewingDate.toISOString(),
        // expiresAt: new Date(viewingDate.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(viewingDate.getTime() + 1 * 60 * 1000).toISOString(),
        users: [],
      };
      writeWatchPartiesData(watchPartiesData);

      await interaction.reply({
        content: 'Annonce publiée avec billetterie.',
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('Erreur /watch avec TMDb :', error);

      return interaction.reply({
        content: 'Une erreur est survenue avec TMDb.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};