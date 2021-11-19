async function get_credential(challenge=Uint8Array.from('unused', c => c.charCodeAt(0)), create_if_missing=true)
{
	credential_id = localStorage.getItem('credential');
	if (credential_id)
	{
		credential = await navigator.credentials.get({
			publicKey: {
				challenge: challenge,
				allowCredentials: [{
					type: 'public-key',
					id: Uint8Array.from(credential_id.split(',')),
				}],
			}
		});

		if (credential)
		{
			console.log('Found existing credential:', credential);
			if (create_if_missing)
			{
				return Uint8Array.from(localStorage.getItem('publickey').split(','));
			}
			else
			{
				return credential;
			}
		}
	}

	if (!create_if_missing)
	{
		return null;
	}

	credential = await navigator.credentials.create({
		publicKey: {
			challenge: challenge,
			rp: {
				name: 'SmartDoor',
			},
			user: {
				id: Uint8Array.from('DoorOpener', c => c.charCodeAt(0)),
				name: 'DoorOpener',
				displayName: 'DoorOpener',
			},
			pubKeyCredParams: [{alg: -7, type: 'public-key'}],
			authenticatorSelection: {
				authenticatorAttachment: 'platform',
				userVerification: 'required',
			},
		},
	});

	publickey = (new Uint8Array(credential.response.getPublicKey())).slice(-64);

	localStorage.setItem('credential', new Uint8Array(credential.rawId));
	localStorage.setItem('publickey', publickey);

	return publickey;
}

document.getElementById('enroll_key').addEventListener('click', async () => {
	credential = await get_credential();
	navigator.bluetooth.requestDevice({filters: [{name: ['IFX Smart Lock']}],optionalServices: [ 'd4712330-b5d6-40ad-9035-70d2798bc1dc' ]})
	.then(device => device.gatt.connect())
	.then(server => server.getPrimaryService('d4712330-b5d6-40ad-9035-70d2798bc1dc'))
	.then(service => service.getCharacteristic('d4712331-b5d6-40ad-9035-70d2798bc1dc'))
	.then(characteristic => characteristic.writeValueWithResponse(credential.buffer))
	.then(_ => {
		console.log('Key enrolled.');
	})
	.catch(error => { console.error(error); });
});

document.getElementById('open_door').addEventListener('click', async () => {
	navigator.bluetooth.requestDevice({filters: [{name: ['IFX Smart Lock']}],optionalServices: [ 'd4712330-b5d6-40ad-9035-70d2798bc1dc' ]})
	.then(device => device.gatt.connect())
	.then(server => server.getPrimaryService('d4712330-b5d6-40ad-9035-70d2798bc1dc'))
	.then(async (service) => {
		console.log('Before get challenge.');
		challenge = await service.getCharacteristic('d4712332-b5d6-40ad-9035-70d2798bc1dc');
		value = await challenge.readValue();
		console.log('Challenge:', value);
		console.log('Before get cred.');
		credential = await get_credential(challenge.buffer, false);
		console.log('Before get 2.');
		authdata = await service.getCharacteristic('d4712334-b5d6-40ad-9035-70d2798bc1dc');
		unused = await authdata.writeValueWithResponse((new Uint8Array(credential.response.authenticatorData)).buffer);
		console.log('Before get 3.');
		clientdata = await service.getCharacteristic('d4712335-b5d6-40ad-9035-70d2798bc1dc');
		unused = await clientdata.writeValueWithResponse((new Uint8Array(credential.response.clientDataJSON)).buffer);
		console.log('Before get 4.');
		response = await service.getCharacteristic('d4712333-b5d6-40ad-9035-70d2798bc1dc');
		console.log('After get Char.');
		var r = (new Uint8Array(credential.response.signature)).slice(4, 36);
		var s = (new Uint8Array(credential.response.signature)).slice(-32);
		var rs = new Uint8Array(Array.from(r).concat(Array.from(s)));
		console.log('Before request.');
		return response.writeValueWithResponse(rs.buffer);
	})
	.then(_ => {
		console.log('Response sent.');
	})
	.catch(error => { console.error(error); });
});
