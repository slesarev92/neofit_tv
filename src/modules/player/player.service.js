const screensRepository = require('../screens/screens.repository');
const screensService = require('../screens/screens.service');
const playlistsRepository = require('../playlists/playlists.repository');
const mediaRepository = require('../media/media.repository');
const settingsRepository = require('../settings/settings.repository');

async function getPlayerData(screenId) {
  const screen = await screensRepository.findById(screenId);
  if (!screen) return null;

  await screensService.updateHeartbeat(screenId);

  const settings = await settingsRepository.get();

  if (!screen.playlistId) {
    return {
      screenId: screen.id,
      screenName: screen.name,
      playlist: null,
      settings,
    };
  }

  const playlist = await playlistsRepository.findById(screen.playlistId);
  if (!playlist) {
    return {
      screenId: screen.id,
      screenName: screen.name,
      playlist: null,
      settings,
    };
  }

  const enrichedItems = [];
  for (const item of (playlist.items || []).sort((a, b) => a.order - b.order)) {
    const media = await mediaRepository.findById(item.mediaId);
    if (media) {
      enrichedItems.push({
        id: item.id,
        order: item.order,
        duration: item.duration,
        media: {
          id: media.id,
          url: `/${media.path}`,
          mimeType: media.mimeType,
          originalName: media.originalName,
        },
      });
    }
  }

  return {
    screenId: screen.id,
    screenName: screen.name,
    playlist: {
      id: playlist.id,
      name: playlist.name,
      items: enrichedItems,
    },
    settings,
  };
}

module.exports = { getPlayerData };
