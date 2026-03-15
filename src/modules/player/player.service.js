const screensRepository = require('../screens/screens.repository');
const screensService = require('../screens/screens.service');
const playlistsRepository = require('../playlists/playlists.repository');
const mediaRepository = require('../media/media.repository');
const settingsRepository = require('../settings/settings.repository');

async function getPlayerData(screenId) {
  const screen = await screensRepository.findById(screenId);
  if (!screen) return null;

  await screensService.updateHeartbeat(screenId);

  const rawSettings = await settingsRepository.get();
  const settings = {
    imageDuration: rawSettings.imageDuration,
    pollInterval: rawSettings.pollInterval,
    requestTimeout: rawSettings.requestTimeout,
    maxRetries: rawSettings.maxRetries,
    prefetchEnabled: rawSettings.prefetchEnabled,
    cacheEnabled: rawSettings.cacheEnabled,
    showLastOnError: rawSettings.showLastOnError,
    autoReloadAt: rawSettings.autoReloadAt,
    workScheduleEnabled: rawSettings.workScheduleEnabled,
    workScheduleFrom: rawSettings.workScheduleFrom,
    workScheduleTo: rawSettings.workScheduleTo,
    workScheduleOffImageUrl: rawSettings.workScheduleOffImageUrl,
    timezone: rawSettings.timezone,
    systemName: rawSettings.systemName,
    logoUrl: rawSettings.logoUrl,
  };

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
    if (media && media.status === 'ready') {
      // Cache-buster: compressedSize changes after re-encoding, forcing SW to re-fetch
      const v = media.compressedSize || '';
      enrichedItems.push({
        id: item.id,
        order: item.order,
        duration: item.duration,
        media: {
          id: media.id,
          url: `/${media.path}${v ? '?v=' + v : ''}`,
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
