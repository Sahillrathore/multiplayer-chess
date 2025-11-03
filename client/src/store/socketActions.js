export const socketQueueJoin = (payload) => ({ type: 'socket/queueJoin', payload });     // { timeControl }
export const socketOfferDraw = (payload) => ({ type: 'socket/offerDraw', payload });     // { gameId }
export const socketResign    = (payload) => ({ type: 'socket/resign', payload });        // { gameId }
export const socketSendMove  = (payload) => ({ type: 'socket/sendMove', payload });      // { gameId, from, to, promotion }
