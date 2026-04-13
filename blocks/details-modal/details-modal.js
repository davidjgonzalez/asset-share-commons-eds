// Copyright 2025 David G.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export default async function decorate(block) {
  block.innerHTML = html();

  addEventListeners(block);
}

function html() {
  return `<dialog>
            <button class="close" aria-label="Close" data-asc-action="asset:details:close@click">&#x2715;</button>

            <div class="content"></div>
        </dialog>`;
}

function addEventListeners(block) {
  // Close via action system (data-asc-action="asset:details:close@click") or direct event
  document.body.addEventListener("asc:asset:details:close", () => {
    block.querySelector("dialog").close();
  });
}
