import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DraftMedia } from '../../components/moment/media-strip';
import { albums } from '../../lib/api';
import type { AlbumDetail, CreateAlbumRequest, UpdateAlbumRequest } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { uploadDrafts } from '../moment/upload-drafts';

/**
 * Every album this account keeps, most recently touched first.
 *
 * Personal and private: the server scopes them to the caller, there is no
 * route that reads somebody else's, and nothing about them reaches a family.
 */
export function useAlbums() {
  return useQuery({
    queryKey: queryKeys.myAlbums(),
    queryFn: () => albums.list(),
  });
}

export function useAlbum(albumId: string | null) {
  return useQuery({
    queryKey: queryKeys.album(albumId ?? ''),
    queryFn: () => albums.detail(albumId as string),
    enabled: albumId !== null,
  });
}

export function useCreateAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateAlbumRequest) => albums.create(body),
    onSuccess: (album) => {
      // Seed the detail cache too: the screen that opens next would otherwise
      // spinner over an album we are already holding.
      queryClient.setQueryData(queryKeys.album(album.id), album);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myAlbums() });
    },
  });
}

/** Rename, redescribe, or set the cover. The cover must already be an item. */
export function useUpdateAlbum(albumId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateAlbumRequest) => {
      if (albumId === null) throw new Error('No album');
      return albums.update(albumId, body);
    },
    onSuccess: (album) => {
      queryClient.setQueryData(queryKeys.album(album.id), album);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myAlbums() });
    },
  });
}

/**
 * Deletes the shelf, not the photographs.
 *
 * Worth saying plainly because it is the opposite of the memo rule: a memo's
 * DELETE takes its media with it, and this one deliberately does not. The
 * pictures stay in the moments they came from.
 */
export function useDeleteAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (albumId: string) => albums.remove(albumId),
    onSuccess: (_result, albumId) => {
      queryClient.removeQueries({ queryKey: queryKeys.album(albumId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myAlbums() });
    },
  });
}

/**
 * Picks become uploads, then album items.
 *
 * Upload first, in that order, because the album takes media **ids** and the
 * server only accepts ids this account uploaded. Handing it a photograph
 * somebody else posted comes back 400 — which is also why there is no "add
 * from the family's photos" here: nothing on the wire says who uploaded a
 * given picture, so the app cannot offer a choice it can honour.
 */
export function useAddAlbumPhotos(albumId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (drafts: DraftMedia[]): Promise<AlbumDetail> => {
      if (albumId === null) throw new Error('No album');

      const mediaIds = await uploadDrafts(drafts);
      return albums.addItems(albumId, { mediaIds });
    },
    onSuccess: (album) => {
      queryClient.setQueryData(queryKeys.album(album.id), album);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myAlbums() });
    },
  });
}

export function useRemoveAlbumItem(albumId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaId: string) => {
      if (albumId === null) throw new Error('No album');
      return albums.removeItem(albumId, mediaId);
    },
    onSuccess: () => {
      if (albumId === null) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.album(albumId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myAlbums() });
    },
  });
}
