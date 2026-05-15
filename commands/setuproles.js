const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setuproles')
    .setDescription('Test setuproles')
    .addStringOption(option =>
      option
        .setName('roles')
        .setDescription('Texte')
        .setRequired(true)
    ),

  async execute(interaction) {
    console.log('setuproles exécuté');
    await interaction.reply({
      content: `Commande reçue avec : ${interaction.options.getString('roles', true)}`,
      ephemeral: true,
    });
  },
};