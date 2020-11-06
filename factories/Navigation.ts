/*
* Copyright (c) 2019 Software AG, Darmstadt, Germany and/or its licensors
*
* SPDX-License-Identifier: Apache-2.0
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
 */
import { Injectable } from '@angular/core';
import { NavigatorNode, NavigatorNodeFactory, _ } from '@c8y/ngx-components';

const nav: NavigatorNode[] = [];

nav.push(new NavigatorNode({
  label: _('Home'),
  icon: 'home',
  path: '/home',
  priority: 100
}));

const source = new NavigatorNode({
  label: _('Source'),
  icon: 'upload',
  path: '/source',
  priority: 99,
  open: true
});
nav.push(source);
source.add(new NavigatorNode({
  label: _('Applications'),
  icon: 'c8y-atom',
  path: '/source/application',
  priority: 99
}));
source.add(new NavigatorNode({
  label: _('Dashboards'),
  icon: 'th',
  path: '/source/dashboard',
  priority: 98
}));
source.add(new NavigatorNode({
  label: _('Groups'),
  icon: 'c8y-group',
  path: '/source/group',
  priority: 98
}));
source.add(new NavigatorNode({
  label: _('Devices'),
  icon: 'c8y-device',
  path: '/source/device',
  priority: 97
}));
source.add(new NavigatorNode({
  label: _('Simulators'),
  icon: 'c8y-simulator',
  path: '/source/simulator',
  priority: 96
}));
source.add(new NavigatorNode({
  label: _('Smart Rules'),
  icon: 'c8y-smart-rules',
  path: '/source/smartrule',
  priority: 96
}));
source.add(new NavigatorNode({
  label: _('Epl Files'),
  icon: 'c8y-analytic-model',
  path: '/source/eplfiles',
  priority: 96
}));
source.add(new NavigatorNode({
  label: _('Binaries'),
  icon: 'c8y-archive',
  path: '/source/binary',
  priority: 95
}));
source.add(new NavigatorNode({
  label: _('Other'),
  icon: 'cubes',
  path: '/source/other',
  priority: 94
}));

const destination = new NavigatorNode({
  label: _('Destination'),
  icon: 'download',
  path: '/destination',
  priority: 98
});
nav.push(destination);

nav.push(new NavigatorNode({
  label: _('Migrate...'),
  icon: 'clone',
  path: '/migrate',
  priority: 95
}));

@Injectable()
export class ExampleNavigationFactory implements NavigatorNodeFactory {
  get() {
    return nav;
  }
}
