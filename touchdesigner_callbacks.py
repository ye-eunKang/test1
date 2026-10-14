"""WebSocket DAT의 Callbacks DAT에 붙여 넣으세요. 같은 위치에 fish_signal Table DAT 필요."""
import json
import time


def onConnect(dat):
    dat.sendText(json.dumps({'type': 'join', 'role': 'td'}))
    return


def onDisconnect(dat):
    return


def onReceiveText(dat, rowIndex, message):
    try:
        data = json.loads(message)
    except (ValueError, TypeError):
        return
    if data.get('type') != 'td:fish':
        return
    event_id = data.get('id')
    if not event_id or data.get('expiresAt', 0) < time.time() * 1000:
        return
    container = dat.parent()
    seen = container.fetch('fish_signal_seen', [])
    if event_id not in seen:
        table = container.op('fish_signal')
        if table is None:
            print('fish_signal Table DAT를 WebSocket DAT와 같은 위치에 추가해주세요.')
            return  # 연결 설정 후 다시 접속하면 서버가 60초 안에 재전송합니다.
        table.clear()
        table.appendRow(['fish', 'signal', 'event_id', 'received_at'])
        table.appendRow([data['fish'], data['signal'], event_id, time.time()])
        container.store('fish_signal_seen', (seen + [event_id])[-100:])
    dat.sendText(json.dumps({'type': 'td:ack', 'id': event_id}))
    return


def onReceivePing(dat, *args):
    dat.sendPong(args[-1] if args else '')
    return
