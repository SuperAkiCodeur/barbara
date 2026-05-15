const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Teste si les slash commands fonctionnent'),

  async execute(interaction) {
    console.log('ping exécuté');

    await interaction.reply({
      content: 'Pong !',
      ephemeral: true,
    });
  },
};